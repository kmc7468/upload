from fastapi import FastAPI, Path, Request, Response
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi_utilities import repeat_at
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

PORT = get_integer_env("PORT", 80, 0)
ID_LENGTH = get_integer_env("ID_LENGTH", 6)
ID_REGEX = f"^[a-zA-Z0-9]{{{ID_LENGTH}}}$"
MAX_FILE_SIZE = get_integer_env("MAX_FILE_SIZE", 1073741824) # Default: 1 GiB
FILE_EXPIRES = get_integer_env("FILE_EXPIRES", 3600) # Default: 1 hour

DIRECTORY = environ.get("DIRECTORY")
if DIRECTORY is None:
    raise ValueError("DIRECTORY environment variable must be set")
elif not path.exists(DIRECTORY):
    raise ValueError(f"DIRECTORY \"{DIRECTORY}\" does not exist")
elif not path.isdir(DIRECTORY):
    raise ValueError(f"DIRECTORY \"{DIRECTORY}\" is not a directory")

print(f"PORT={PORT}")
print(f"DIRECTORY=\"{path.abspath(DIRECTORY)}\"")
print(f"ID_LENGTH={ID_LENGTH}")
print(f"MAX_FILE_SIZE={MAX_FILE_SIZE}")
print(f"FILE_EXPIRES={FILE_EXPIRES}")

app = FastAPI()
mime = Magic(mime=True)

def generate_random_filename(length: int):
    chars = string.ascii_letters + string.digits

    result = "".join(random.choices(chars, k=length))
    return result

def generate_unique_filename():
    while True:
        filename = generate_random_filename(ID_LENGTH)
        if not path.exists(path.join(DIRECTORY, filename)):
            return filename

@app.get("/")
def index():
    try:
        return FileResponse("static/index.html", media_type="text/html")
    except:
        return Response(status_code=500)

@app.put("/{filename}")
async def upload_file(filename: str, request: Request):
    try:
        host = request.headers.get("Host")
        if host is None:
            return Response(status_code=400)

        file = await request.body()
        if len(file) > MAX_FILE_SIZE:
            return Response(status_code=413)

        target_filename = generate_unique_filename()
        target_path = path.join(DIRECTORY, target_filename)
        with open(target_path, "wb") as file:
            file.write(await request.body())

        return PlainTextResponse(f"https://{host}/{target_filename}/{quote(filename)}\n")
    except:
        return Response(status_code=500)

def download_file_body(id: str, filename: str | None):
    try:
        target_path = path.join(DIRECTORY, id)
        if not path.exists(target_path):
            return Response(status_code=404)

        return FileResponse(target_path, media_type=mime.from_file(target_path), filename=filename)
    except:
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
        for file in listdir(DIRECTORY):
            target_path = path.join(DIRECTORY, file)
            if path.isfile(target_path) and path.getmtime(target_path) + FILE_EXPIRES < time():
                remove(target_path)
    except:
        pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)