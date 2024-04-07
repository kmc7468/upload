from fastapi import FastAPI, Path, Request, Response
from fastapi.responses import FileResponse
from os import environ, path
import random
import string

DIRECTORY = environ.get("DIRECTORY")
if DIRECTORY is None:
    raise ValueError("DIRECTORY environment variable must be set")
elif not path.exists(DIRECTORY):
    raise ValueError(f"DIRECTORY {DIRECTORY} does not exist")
elif not path.isdir(DIRECTORY):
    raise ValueError(f"DIRECTORY {DIRECTORY} is not a directory")

ID_LENGTH = environ.get("ID_LENGTH")
if ID_LENGTH is not None:
    try:
        ID_LENGTH = int(ID_LENGTH)
        if ID_LENGTH <= 0:
            raise ValueError("ID_LENGTH must be a positive integer")
    except:
        raise ValueError("ID_LENGTH must be a positive integer")
else:
    ID_LENGTH = 6 # Default value for ID_LENGTH

ID_REGEX = f"^[a-zA-Z0-9]{{{ID_LENGTH}}}$"

MAX_FILE_SIZE = environ.get("MAX_FILE_SIZE")
if MAX_FILE_SIZE is not None:
    try:
        MAX_FILE_SIZE = int(MAX_FILE_SIZE)
        if MAX_FILE_SIZE <= 0:
            raise ValueError("MAX_FILE_SIZE must be a positive integer")
    except:
        raise ValueError("MAX_FILE_SIZE must be a positive integer")
else:
    MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024 # Default value for MAX_FILE_SIZE, which is 1 GiB

print(f"DIRECTORY=\"{path.abspath(DIRECTORY)}\"")
print(f"ID_LENGTH={ID_LENGTH}")
print(f"MAX_FILE_SIZE={MAX_FILE_SIZE}")

app = FastAPI()

def generate_random_filename(length: int):
    chars = string.ascii_letters + string.digits

    result = "".join(random.choices(chars, k=length))
    return result

def generate_unique_filename():
    while True:
        filename = generate_random_filename(ID_LENGTH)
        if not path.exists(path.join(DIRECTORY, filename)):
            return filename

@app.put("/{filename}")
async def upload_file(filename: str, request: Request):
    try:
        host = request.headers.get("Host")
        if host is None:
            return Response(status_code=400)

        file = await request.body()

        target_filename = generate_unique_filename()
        target_path = path.join(DIRECTORY, target_filename)
        with open(target_path, "wb") as file:
            file.write(await request.body())

        return Response(content=f"https://{host}/{target_filename}/{filename}\n")
    except:
        return Response(status_code=500)

def download_file_body(id: str):
    try:
        target_path = path.join(DIRECTORY, id)
        if not path.exists(target_path):
            return Response(status_code=404)

        return FileResponse(target_path)
    except:
        return Response(status_code=500)

@app.get("/{id}")
async def download_file(id: str = Path(..., regex=ID_REGEX)):
    return download_file_body(id)

@app.get("/{id}/{filename}")
async def download_file_as(id: str = Path(..., regex=ID_REGEX), filename: str = Path(...)):
    return download_file_body(id)