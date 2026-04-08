#!/bin/bash
# Kilo Code Worktree Setup Script
# This script runs before the agent starts in a worktree (new sessions only).
#
# Available environment variables:
#   WORKTREE_PATH  - Absolute path to the worktree directory
#   REPO_PATH      - Absolute path to the main repository
#
# Example tasks:
#   - Copy .env files from main repo
#   - Install dependencies
#   - Run database migrations
#   - Set up local configuration

set -e  # Exit on error

echo "Setting up worktree: $WORKTREE_PATH"

# Uncomment and modify as needed:

# Copy environment files
# if [ -f "$REPO_PATH/.env" ]; then
#     cp "$REPO_PATH/.env" "$WORKTREE_PATH/.env"
#     echo "Copied .env"
# fi

# Install dependencies (Node.js)
# if [ -f "$WORKTREE_PATH/package.json" ]; then
#     cd "$WORKTREE_PATH"
#     npm install
# fi

# Install dependencies (Python)
# if [ -f "$WORKTREE_PATH/requirements.txt" ]; then
#     cd "$WORKTREE_PATH"
#     pip install -r requirements.txt
# fi

echo "Setup complete!"
