#!/bin/bash

# List of pages to move (excluding page.tsx which is our redirect)
pages=(
  "reports"
  "team"
  "clients"
  "coopspots"
  "tasks"
  "campaigns"
  "invoices"
  "activities"
  "portal"
  "pricing"
  "proofs"
  "calendar"
  "import"
  "territories"
  "reminders"
  "templates"
  "prospects"
  "eddm"
  "offers"
  "email"
)

# Move each page to (dashboard) folder
for page in "${pages[@]}"; do
  if [ -d "src/app/$page" ]; then
    echo "Moving $page to (dashboard)..."
    mv "src/app/$page" "src/app/(dashboard)/$page"
  fi
done

echo "Done! All pages moved to (dashboard) folder."
