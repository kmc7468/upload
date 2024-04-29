var fileInput = document.getElementById("fileInput");
var curl = document.getElementById("curl");
var curlDisposable = document.getElementById("curlDisposable");
var isDisposable = document.getElementById("isDisposable");

fileInput.addEventListener("change", function() {
  var file = this.files[0];
  if (!file) return;

  if (file.size > 1073741824) {
    alert("The file is too large.");
    return;
  }

  uploadFile(file);
});
isDisposable.addEventListener("change", function() {
  if (isDisposable.checked) {
    curl.style.display = "none";
    curlDisposable.style.display = "block";
  } else {
    curl.style.display = "block";
    curlDisposable.style.display = "none";
  }
});

function uploadFile(file) {
  var filename = encodeURI(file.name);

  var xhr = new XMLHttpRequest();
  xhr.open("PUT", `${window.location.origin}/${isDisposable.checked ? "d/" : ""}${filename}`, true);
  xhr.setRequestHeader("Content-Type", "application/octet-stream");

  xhr.onload = function() {
    if (xhr.status === 200) {
      showDownloadUrl(xhr.responseText.substring(0, xhr.responseText.length - 1));
    } else {
      showErrorMessage();
    }
  };
  xhr.onerror = function() {
    showErrorMessage();
  };

  showUploadingMessage();
  xhr.send(file);
}

function showUploadingMessage() {
  fileInput.disabled = true;

  var status = document.getElementById("status");
  status.textContent = "Uploading the file...";
  status.style.display = "inline";

  var url = document.getElementById("url");
  url.style.display = "none";

  var convertingUrls = document.getElementById("convertingUrls");
  convertingUrls.style.display = "none";

  isDisposable.disabled = true;
}

function showDownloadUrl(downloadUrl) {
  fileInput.disabled = false;

  var status = document.getElementById("status");
  status.textContent = "Download URL: ";
  status.style.display = "inline";

  var url = document.getElementById("url");
  url.textContent = decodeURI(downloadUrl);
  url.href = downloadUrl;
  url.style.display = "inline";

  var convertingUrls = document.getElementById("convertingUrls");
  convertingUrls.style.display = "inline";

  var jpegUrl = document.getElementById("jpegUrl");
  jpegUrl.href = downloadUrl + ".jpg?jpg";

  var pngUrl = document.getElementById("pngUrl");
  pngUrl.href = downloadUrl + ".png?png";

  isDisposable.disabled = false;

  alert("The file has been uploaded successfully.");
}

function showErrorMessage() {
  fileInput.disabled = false;

  var status = document.getElementById("status");
  status.textContent = "Failed to upload the file!";
  status.style.display = "inline";

  var url = document.getElementById("url");
  url.style.display = "none";

  var convertingUrls = document.getElementById("convertingUrls");
  convertingUrls.style.display = "none";

  isDisposable.disabled = false;

  alert("An error occurred while uploading the file.");
}