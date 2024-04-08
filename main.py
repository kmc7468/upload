from fastapi import FastAPI, Path, Request, Response
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi_utilities import repeat_at
from hashlib import sha256
from magic import Magic
from os import environ, listdir, path, remove
import random
import string
from time import time
from urllib.parse import quote
import uvicorn

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
FILE_EXPIRES = get_integer_env("FILE_EXPIRES", 3600) # Default: 1 hour

DIRECTORY = get_directory_env("DIRECTORY")
#LOG_DIRECTORY = get_directory_env("LOG_DIRECTORY")

print(f"PORT={PORT}")
print(f"ID_LENGTH={ID_LENGTH}")
print(f"MAX_FILE_SIZE={MAX_FILE_SIZE}")
print(f"FILE_EXPIRES={FILE_EXPIRES}")
print(f"DIRECTORY=\"{DIRECTORY}\"")
#print(f"LOG_DIRECTORY=\"{LOG_DIRECTORY}\"")

app = FastAPI()
mime = Magic(mime=True)

def generate_random_filename(length: int):
  chars = string.ascii_letters + string.digits
  result = "".join(random.choices(chars, k=length))
  return result

def generate_unique_filename():
  while True:
    filename = generate_random_filename(ID_LENGTH)
    if not path.exists(path.join(DIRECTORY, filename)) and not path.exists(path.join(DIRECTORY, filename + ".d")):
      return filename

@app.get("/")
def index():
  try:
    return FileResponse("static/index.html", media_type="text/html")
  except Exception as e:
    print(e)
    return Response(status_code=500)

async def upload_file_body(filename: str, request: Request, disposable: bool):
  try:
    host = request.headers.get("Host")
    if host is None:
      return Response(status_code=400)

    file = await request.body()
    if len(file) == 0:
      return Response(status_code=400)
    elif len(file) > MAX_FILE_SIZE:
      return Response(status_code=413)

    target_filename = generate_unique_filename()
    target_filename_real = target_filename + (".d" if disposable else "")
    target_path = path.join(DIRECTORY, target_filename_real)
    with open(target_path, "wb") as target_file:
      target_file.write(file)

    hash = sha256(file).hexdigest()
    print(f"File \"{filename}\" uploaded as \"{target_filename_real}\" with hash \"{hash}\"")

    return PlainTextResponse(f"https://{host}/{target_filename}/{quote(filename)}\n")
  except Exception as e:
    print(e)
    return Response(status_code=500)

@app.put("/{filename}")
async def upload_file(filename: str, request: Request):
  return await upload_file_body(filename, request, False)

@app.put("/d/{filename}")
async def upload_file_disposable(filename: str, request: Request):
  return await upload_file_body(filename, request, True)

def read_from_file(id: str, ext: str = ""):
  target_path = path.join(DIRECTORY, id + ext)
  if path.exists(target_path):
    with open(target_path, "rb") as target_file:
      return target_file.read(), target_path
  else:
    return None, None

def make_file_response(filename: str, file: bytes):
  disposition = f"attachment; filename={quote(filename)}" if filename is not None else "inline"
  return Response(content=file, media_type=mime.from_buffer(file), headers={"Content-Disposition": disposition}) 

def download_file_body(id: str, filename: str | None):
  try:
    file, _ = read_from_file(id)
    if file is not None:
      return make_file_response(filename, file)

    file, target_path = read_from_file(id, ".d")
    if file is not None:
      remove(target_path)
      return make_file_response(filename, file)

    return Response(status_code=404)
  except Exception as e:
    print(e)
    return Response(status_code=500)

@app.get("/{id}")
def download_file(id: str = Path(..., pattern=ID_REGEX)):
  return download_file_body(id, None)

@app.get("/{id}/{filename}")
def download_file_as(id: str = Path(..., pattern=ID_REGEX), filename: str = Path(...)):
  return download_file_body(id, filename)

@app.on_event("startup")
@repeat_at(cron="* * * * *")
def cleanup():
  try:
    for filename in listdir(DIRECTORY):
      target_path = path.join(DIRECTORY, filename)
      if path.isfile(target_path) and path.getmtime(target_path) + FILE_EXPIRES < time():
        remove(target_path)
  except Exception as e:
    print(e)

if __name__ == "__main__":
  uvicorn.run(app, host="0.0.0.0", port=PORT)