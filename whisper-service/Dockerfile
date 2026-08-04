# base image/runtime language
FROM python:3.12-slim

# the image's root directory, arbitrary name but /app is conventional
WORKDIR /app

# copy the requirements/dependencies file in the whisper-service folder, and then install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# download the whisper model to container since it's pretty expensive. then cached after first time. it's before copying code so if code changes, don't need to redownload
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu')"

# copy all code in folder to container's /app directory
COPY *.py .

# document the port the app listens on. doesn't matter that it's below copy code, since it's just documentation. but it should be above the CMD command, since that is the actual command that runs the app.
EXPOSE 8000

# start command. --host 0.0.0.0 (NOT localhost) so OTHER containers can reach it.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


# the dockerfile is a container that holds all the dependencies and code for a certain service
# it acts as a snapshot, with all the necessary dependencies to run a service
# it follows a sequential order, so the order of commands matters. usually you want to keep dependencies which rarely change in the beginning
# this is because once docker builds a layer once, it caches it. then every time you rebuild, it will check if the layer has changed.
# if it has not changed, it will get the cached layer instead of rebuilding. however if it has changed, it will rebuild, as well as all the layers
# under it. so first it's usually the dependencies like runtime language, the directory, and requirements, which should not change often.
# then in this service, we download a model, which shouldn't change, then after that we copy code which will prob change more frequently. 
