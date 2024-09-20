#!/bin/bash

TARGET_FILE="$HOME/.bashrc"
SCRIPT=$(cat << "EOF"
upload() {
  local path=""
  local d_option=0
  local e_option=0

  for arg in "$@"; do
    case "$arg" in
      -d) d_option=1 ;;
      -e) e_option=1 ;;
      -de) d_option=1; e_option=1 ;;
      -ed) d_option=1; e_option=1 ;;
      -*) echo "Error: invalid option '$arg'" >&2; return 1; ;;
      *) path="$arg" ;;
    esac
  done

  if [[ -z "$path" ]]; then
    echo "Usage: upload [-de] <File>" >&2
    return 1
  fi

  local url_options=""

  if [[ $d_option -eq 1 ]]; then
    url_options+="d"
  fi
  if [[ $e_option -eq 1 ]]; then
    url_options+="e"
  fi
  if [[ -n "$url_options" ]]; then
    url_options+="/"
  fi

  local url="https://upload.minchan.me/$url_options"
  local filename=$(basename "$path")

  if type python3 &> /dev/null; then
    local encoded_filename=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$filename', safe=':/?&'))")
  else
    local encoded_filename=$(echo -n "$filename" | sed 's/ /%20/g')
  fi

  if [[ $e_option -eq 1 ]]; then
    openssl enc -e -aes-256-cbc -pbkdf2 < "$path" | curl --upload-file - "$url$encoded_filename"
  else
    curl --upload-file "$path" "$url$encoded_filename"
  fi
}
EOF
)

{
  # Check if the target file exists
  if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: $TARGET_FILE does not exist." >&2
    exit 1
  fi

  # Check if the upload command is already installed
  # If it is, remove it first
  if grep -q "upload() {" "$TARGET_FILE"; then
    sed -i '/^upload() {/,/^}/d' "$TARGET_FILE"
  fi

  # Install the upload command
  echo "$SCRIPT" >> "$TARGET_FILE"
  source "$TARGET_FILE"

  echo "upload command has been successfully installed."
}