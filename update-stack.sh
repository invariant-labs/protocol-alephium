#!/usr/bin/env bash

echo "downloading the newest version of alephium-stack"

if curl -o "alephium-stack.zip" -L https://github.com/alephium/alephium-stack/archive/refs/heads/master.zip; then
    unzip  -q alephium-stack
    if [ -d "alephium-stack-master" ]; then
        rm -r alephium-stack
        echo "removed the old stack"
    fi
    mv "alephium-stack-master" "alephium-stack"
    echo "renamed the new stack"
    rm "alephium-stack.zip"
    echo "alephium-stack succesfully updated"
else
    echo "download failed"
fi
