#!/bin/bash
set -e

echo "=== LunarVista App Service Startup ==="
cd /home/site/wwwroot 2>/dev/null || cd .

# If Oryx antenv exists, activate it
if [ -f "/antenv/bin/activate" ]; then
    source /antenv/bin/activate
elif [ -f "antenv/bin/activate" ]; then
    source antenv/bin/activate
elif [ -f "/home/site/wwwroot/antenv/bin/activate" ]; then
    source /home/site/wwwroot/antenv/bin/activate
fi

# If uvicorn is still not available, install directly into user/site python
if ! python -c "import uvicorn" 2>/dev/null; then
    echo "uvicorn not found in current environment. Installing requirements..."
    pip install --no-cache-dir -r backend/requirements.txt
fi

export PYTHONPATH="backend:${PYTHONPATH:-}"
echo "Launching Uvicorn on 0.0.0.0:8000..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend
