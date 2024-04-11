from datetime import datetime
from fastapi import FastAPI, Path, Request, Response
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi_utilities import repeat_at
from hashlib import sha256
from io import BytesIO
import logging
from magic import Magic
from os import environ, listdir, makedirs, path, remove
from PIL import Image
from pillow_heif import register_heif_opener
import random
import string
from time import time
from urllib.parse import quote
import uvicorn

#################################
##### Environment variables #####
#################################

def get_integer_env(name: str, default: int, min_value: int = 1):
  value = environ.get(name)
  if value is not None:
    try:
      value = int(value)
      if value < min_value:
        raise ValueError(f"{name} must be at least {min_value}")
      return value
    except:
      raise ValueError(f"{name} must be an integer")
  else:
    return default

def get_directory_env(name: str):
  value = environ.get(name)
  if value is None:
    raise ValueError(f"{name} environment variable must be set")

  value = path.abspath(value)
  if not path.exists(value):
    raise ValueError(f"{name} \"{value}\" does not exist")
  elif not path.isdir(value):
    raise ValueError(f"{name} \"{value}\" is not a directory")
  else:
    return value

PORT = get_integer_env("PORT", 80, 0)
ID_LENGTH = get_integer_env("ID_LENGTH", 6)
ID_REGEX = f"^[a-zA-Z0-9]{{{ID_LENGTH}}}$"
MAX_FILE_SIZE = get_integer_env("MAX_FILE_SIZE", 1073741824) # Default: 1 GiB
MAX_CONVERTIBLE_IMAGE_SIZE = get_integer_env("MAX_CONVERTIBLE_IMAGE_SIZE", 31457280) # Default: 30 MiB
FILE_EXPIRES = get_integer_env("FILE_EXPIRES", 3600) # Default: 1 hour
TRUST_PROXY = get_integer_env("TRUST_PROXY", 0, 0) # Default: 0

DIRECTORY = get_directory_env("DIRECTORY")
CONVERT_DIRECTORY = path.join(DIRECTORY, "converts")
LOG_DIRECTORY = get_directory_env("LOG_DIRECTORY")

############################
##### Global variables #####
############################

app = FastAPI()
logger = logging.getLogger(__file__)
mime = Magic(mime=True)

########################
##### Static files #####
########################

@app.get("/")
def index():
  try:
    return FileResponse("static/index.html", media_type="text/html")
  except Exception as e:
    logger.error(e)
    return Response(status_code=500)

#####################
##### Uploading #####
#####################

def generate_random_filename(length: int):
  chars = string.ascii_letters + string.digits
  result = "".join(random.choices(chars, k=length))
  return result

def generate_unique_filename():
  while True:
    filename = generate_random_filename(ID_LENGTH)
    if not path.exists(path.join(DIRECTORY, filename)) and not path.exists(path.join(DIRECTORY, filename + ".d")):
      return filename

def get_client_ip(request: Request):
  if TRUST_PROXY > 0:
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for is None:
      raise ValueError("X-Forwarded-For header must be set")
    return x_forwarded_for.split(",")[-TRUST_PROXY].strip()
  else:
    return request.client.host

async def upload_file_body(filename: str, request: Request, disposable: bool):
  try:
    host = request.headers.get("Host")
    if host is None:
      return Response(status_code=400)

    content_length = request.headers.get("Content-Length")
    if content_length is None:
      return Response(status_code=411)
    try:
      content_length = int(content_length)
      if content_length > MAX_FILE_SIZE:
        return Response(status_code=413)
    except:
      return Response(status_code=400)

    file = await request.body()
    file_length = len(file)
    if file_length == 0 or file_length != content_length:
      return Response(status_code=400)
    elif file_length > MAX_FILE_SIZE:
      return Response(status_code=413)

    hash = sha256(file).hexdigest()
    client_ip = get_client_ip(request)

    target_filename = generate_unique_filename()
    target_filename_real = target_filename + (".d" if disposable else "")
    target_path = path.join(DIRECTORY, target_filename_real)
    with open(target_path, "wb") as target_file:
      target_file.write(file)

    logger.info(f"File \"{filename}\" uploaded as \"{target_filename_real}\" with hash \"{hash}\" by \"{client_ip}\" ({file_length} bytes)")

    return PlainTextResponse(f"https://{host}/{target_filename}/{quote(filename)}\n")
  except Exception as e:
    logger.error(e)
    return Response(status_code=500)

@app.put("/{filename}")
async def upload_file(filename: str, request: Request):
  return await upload_file_body(filename, request, False)

@app.put("/d/{filename}")
async def upload_file_disposable(filename: str, request: Request):
  return await upload_file_body(filename, request, True)

#######################
##### Downloading #####
#######################

def read_from_file(id: str, ext: str = ""):
  target_path = path.join(DIRECTORY, id + ext)
  if path.exists(target_path):
    with open(target_path, "rb") as target_file:
      return target_file.read(), target_path
  else:
    return None, None

def convert_image_format(file: bytes, to_format: str):
  with Image.open(BytesIO(file)) as image:
    params = {}
    if image.info.get("exif") is not None:
      params["exif"] = image.info.get("exif")
    if image.info.get("icc_profile") is not None:
      params["icc_profile"] = image.info.get("icc_profile")

    if to_format == "JPEG":
      params["quality"] = 95 # Best
      params["subsampling"] = 0 # 4:4:4

    buffer = BytesIO()
    image.save(buffer, format=to_format, **params)
    return buffer.getvalue()

def read_from_converted_file(id: str, org_file: bytes, org_mime: str, format: str, cache: bool):
  target_path = path.join(CONVERT_DIRECTORY, id + "." + format)
  if cache and path.exists(target_path):
    with open(target_path, "rb") as target_file:
      return target_file.read()
  else:
    if format == "JPEG" or format == "PNG":
      if not org_mime.startswith("image/"):
        return Response(status_code=415)
      elif len(org_file) > MAX_CONVERTIBLE_IMAGE_SIZE:
        return Response(status_code=413)
      file = convert_image_format(org_file, format)
    else:
      raise ValueError(f"{format} is not a supported format")

    if cache and len(file) <= MAX_FILE_SIZE:
      with open(target_path, "wb") as target_file:
        target_file.write(file)
    return file

def extract_required_format(request: Request):
  for key in request.query_params.keys():
    if key == "jpg" or key == "jpeg":
      return "JPEG"
    elif key == "png":
      return "PNG"
  else:
    return None

def download_file_body(id: str, filename: str | None, request: Request):
  try:
    def make_file_response(file: bytes, ext: str = ""):
      required_format = extract_required_format(request)
      if required_format is not None:
        file = read_from_converted_file(id, file, mime.from_buffer(file), required_format, ext != ".d")
        if isinstance(file, Response):
          return file

      client_ip = get_client_ip(request)
      logger.info(f"File \"{id + ext}\" downloaded by \"{client_ip}\"")

      disposition = f"attachment; filename={quote(filename)}" if filename is not None else "inline"
      return Response(content=file, media_type=mime.from_buffer(file), headers={"Content-Disposition": disposition})

    file, _ = read_from_file(id)
    if file is not None:
      return make_file_response(file)

    file, target_path = read_from_file(id, ".d")
    if file is not None:
      remove(target_path)
      return make_file_response(file, ".d")

    return Response(status_code=404)
  except Exception as e:
    logger.error(e)
    return Response(status_code=500)

@app.get("/{id}")
def download_file(id: str = Path(..., pattern=ID_REGEX), request: Request = None):
  return download_file_body(id, None, request)

@app.get("/{id}/{filename}")
def download_file_as(id: str = Path(..., pattern=ID_REGEX), filename: str = Path(...), request: Request = None):
  return download_file_body(id, filename, request)

#####################
##### Cron jobs #####
#####################

def remove_if_exists(target_path: str):
  if path.exists(target_path):
    remove(target_path)

@app.on_event("startup")
@repeat_at(cron="* * * * *")
def cleanup():
  try:
    for filename in listdir(DIRECTORY):
      target_path = path.join(DIRECTORY, filename)
      if path.isfile(target_path) and path.getmtime(target_path) + FILE_EXPIRES < time():
        remove(target_path)

        if not filename.endswith(".d"):
          remove_if_exists(path.join(CONVERT_DIRECTORY, filename + ".JPEG"))
          remove_if_exists(path.join(CONVERT_DIRECTORY, filename + ".PNG"))

  except Exception as e:
    logger.error(e)

######################
##### Entrypoint #####
######################

if __name__ == "__main__":
  logger.level = logging.DEBUG
  logger.handlers = [
    logging.FileHandler(path.join(LOG_DIRECTORY, datetime.now().strftime("%Y%m%d-%H%M%S") + ".log")),
    logging.StreamHandler()
  ]
  for handler in logger.handlers:
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s", "%Y-%m-%d %H:%M:%S"))

  logger.debug(f"PORT={PORT}")
  logger.debug(f"ID_LENGTH={ID_LENGTH}")
  logger.debug(f"MAX_FILE_SIZE={MAX_FILE_SIZE}")
  logger.debug(f"MAX_CONVERTIBLE_IMAGE_SIZE={MAX_CONVERTIBLE_IMAGE_SIZE}")
  logger.debug(f"FILE_EXPIRES={FILE_EXPIRES}")
  logger.debug(f"TRUST_PROXY={TRUST_PROXY}")
  logger.debug(f"DIRECTORY=\"{DIRECTORY}\"")
  logger.debug(f"LOG_DIRECTORY=\"{LOG_DIRECTORY}\"")

  if not path.exists(CONVERT_DIRECTORY):
    makedirs(CONVERT_DIRECTORY)
  elif not path.isdir(CONVERT_DIRECTORY):
    raise ValueError(f"\"{CONVERT_DIRECTORY}\" is not a directory")

  register_heif_opener()

  uvicorn.run(app, host="0.0.0.0", port=PORT)