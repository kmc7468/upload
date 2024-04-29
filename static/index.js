const ONE_KIBI = 1024;
const ONE_MEBI = 1024 * ONE_KIBI;
const ONE_GIBI = 1024 * ONE_MEBI;

const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", function() {
  const file = this.files[0];
  if (!file) return;
  if (file.size > ONE_GIBI) {
    alert("The file is too large.");
    return;
  }

  uploadFile(file);
});

const isDisposable = document.getElementById("isDisposable");
isDisposable.addEventListener("change", function() {
  const curl = document.getElementById("curl");
  const curlDisposable = document.getElementById("curlDisposable");

  if (isDisposable.checked) {
    curl.style.display = "none";
    curlDisposable.style.display = "inline";
  } else {
    curl.style.display = "inline";
    curlDisposable.style.display = "none";
  }
});

function determineFileType(file) {
  if (file.type) return file.type;

  const filenameLower = file.name.toLowerCase();
  if (filenameLower.endsWith(".heic")) return "image/heic";
  if (filenameLower.endsWith(".heif")) return "image/heif";

  return "";
}

function determineUploadSpeed(bytespersec) {
  if (bytespersec < ONE_KIBI) return `${bytespersec} B/s`;
  else if (bytespersec < ONE_MEBI) return `${Math.round(bytespersec / ONE_KIBI)} KiB/s`;
  else if (bytespersec < ONE_GIBI) return `${Math.round(bytespersec / ONE_MEBI)} MiB/s`;
  else return `${Math.round(bytespersec / ONE_GIBI)} GiB/s`;
}

function uploadFile(file) {
  const filename = encodeURI(file.name);
  const filetype = determineFileType(file);

  const xhr = new XMLHttpRequest();
  xhr.open("PUT", `${window.location.origin}/${isDisposable.checked ? "d/" : ""}${filename}`, true);
  xhr.setRequestHeader("Content-Type", filetype || "application/octet-stream");

  xhr.addEventListener("load", function() {
    if (xhr.status === 200) {
      showDownloadUrl(xhr.responseText.substring(0, xhr.responseText.length - 1), filetype);
    } else {
      showErrorMessage();
    }
  });
  xhr.addEventListener("error", function() {
    showErrorMessage();
  });

  let time, loaded;
  xhr.upload.addEventListener("loadstart", function() {
    time = Date.now();
    loaded = 0;
  });
  xhr.upload.addEventListener("progress", function(event) {
    if (event.lengthComputable) {
      const percent = Math.floor(event.loaded / event.total * 100);
      const speed = (event.loaded - loaded) / (Date.now() - time) * 1000;
      const status = document.getElementById("status");
      status.textContent = `Uploading the file... (${percent}%, ${determineUploadSpeed(speed)})`;
    }
  });

  showUploadingMessage();
  xhr.send(file);
}

function showUploadingMessage() {
  fileInput.disabled = true;

  const status = document.getElementById("status");
  status.textContent = "Uploading the file...";
  status.style.display = "inline";

  const url = document.getElementById("url");
  url.style.display = "none";

  const convertingUrls = document.getElementById("convertingUrls");
  convertingUrls.style.display = "none";

  isDisposable.disabled = true;
}

function showDownloadUrl(downloadUrl, filetype) {
  fileInput.disabled = false;

  const status = document.getElementById("status");
  status.textContent = "Download URL: ";
  status.style.display = "inline";

  const url = document.getElementById("url");
  url.textContent = decodeURI(downloadUrl);
  url.href = downloadUrl;
  url.style.display = "inline";

  if (filetype.startsWith("image/")) {
    const convertingUrls = document.getElementById("convertingUrls");
    convertingUrls.style.display = "inline";
  
    const jpegUrl = document.getElementById("jpegUrl");
    jpegUrl.href = downloadUrl + ".jpg?jpg";
  
    const pngUrl = document.getElementById("pngUrl");
    pngUrl.href = downloadUrl + ".png?png";
  }

  isDisposable.disabled = false;

  alert("The file has been uploaded successfully.");
}

function showErrorMessage() {
  fileInput.disabled = false;

  const status = document.getElementById("status");
  status.textContent = "Failed to upload the file!";
  status.style.display = "inline";

  const url = document.getElementById("url");
  url.style.display = "none";

  const convertingUrls = document.getElementById("convertingUrls");
  convertingUrls.style.display = "none";

  isDisposable.disabled = false;

  alert("An error occurred while uploading the file.");
}