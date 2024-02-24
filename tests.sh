#!/bin/bash

set -e

ALEPHIUM_STACK_DIR="alephium-stack"
ALEPHIUM_CLI_PACKAGE="@alephium/cli@latest"

# Start the Alephium devnet
(
  cd $ALEPHIUM_STACK_DIR
  make start-devnet
)
sleep 10s

# Compile and test using Alephium CLI
npx $ALEPHIUM_CLI_PACKAGE compile 
npx $ALEPHIUM_CLI_PACKAGE test

# Stop the Alephium devnet
(
  cd $ALEPHIUM_STACK_DIR
  make stop-devnet
)

echo "Completed successfully"