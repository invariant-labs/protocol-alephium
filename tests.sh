#!/bin/bash

set -e

ALEPHIUM_STACK_DIR="alephium-stack"
ALEPHIUM_CLI_PACKAGE="@alephium/cli@latest"

# Install npm packages
npm install

# Start the Alephium devnet
(
  cd $ALEPHIUM_STACK_DIR
  make start-devnet
)

# Compile and test using Alephium CLI from the project root directory
npx $ALEPHIUM_CLI_PACKAGE compile 
npx $ALEPHIUM_CLI_PACKAGE test

# Stop the Alephium devnet
(
  cd $ALEPHIUM_STACK_DIR
  make stop-devnet
)

echo "Completed successfully"