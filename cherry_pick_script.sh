#!/bin/bash

# Get the list of commits to cherry-pick in order, starting from the 178th (after manually applying 177)
commits=$(git rev-list --reverse 8559feed..upstream/main | tail -n +178)

# Initialize counter
count=178
total=$(echo "$commits" | wc -l)
total=$((total + 178))  # Since we start from 178, total is 314 - 178 = 136

echo "Starting cherry-pick from commit 178 of $total commits..."

for commit in $commits; do
    echo "Checking commit $count/$total: $commit"
    if git merge-base --is-ancestor $commit HEAD 2>/dev/null; then
        echo "Commit $commit is already applied, skipping."
    elif [ $(git cat-file -p $commit | grep -c '^parent') -gt 1 ]; then
        echo "Commit $commit is a merge commit, skipping."
    else
        echo "Cherry-picking commit $count/$total: $commit"
        output=$(git cherry-pick $commit 2>&1)
        exit_code=$?
        if [ $exit_code -eq 0 ]; then
            if echo "$output" | grep -q "is now empty\|nothing added to commit"; then
                echo "Commit $commit is empty (already applied), skipping."
                git cherry-pick --skip 2>/dev/null || true
            else
                echo "Successfully cherry-picked $commit"
            fi
        else
            echo "Conflict detected in commit $commit. Stopping."
            echo "Resolve conflicts manually and run 'git cherry-pick --continue' or 'git cherry-pick --abort'"
            exit 1
        fi
    fi
    ((count++))
done

echo "All remaining commits cherry-picked successfully."