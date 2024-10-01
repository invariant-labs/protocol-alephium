#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to increment version
increment_version() {
  local version=$1

  IFS='.' read -ra parts <<< "$version"
  major=${parts[0]}
  minor=${parts[1]}
  patch=${parts[2]}
  patch=$((patch + 1))
 
  echo "$major.$minor.$patch"
}

# Get current version from package.json
current_version=$(node -p "require('./package.json').version")

# Increment version (default to patch)
new_version=$(increment_version "$current_version")

if [ "$1" != "--skip-compile" ]; then
  # Compile the Ralph code
  npm run compile
fi

# Run build
npm run build

# Update version in package.json
npm version $new_version --no-git-tag-version

# Publish to npm
npm publish

echo "Successfully built and published version $new_version"