from fastapi import FastAPI, Request, Response
import httpx
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Bật CORS để Frontend không bị chặn
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(request: Request, path_name: str):
    if path_name == "favicon.ico":
        return Response(status_code=204)

    if path_name == "api/v1":
        target_path = "api"
    elif path_name.startswith("api/v1/"):
        target_path = "api/" + path_name[len("api/v1/"):]
    else:
        target_path = path_name

    async with httpx.AsyncClient() as client:
        # Điều hướng mọi thứ từ 8000 sang 8001
        url = f"http://127.0.0.1:8001/{target_path}"
        content = await request.body()
        headers = dict(request.headers)
        headers.pop("host", None) # Quan trọng để không bị lỗi loop
        headers.pop("content-length", None)
        
        response = await client.request(
            method=request.method,
            url=url,
            params=request.query_params,
            content=content,
            headers=headers
        )
        passthrough_headers = {
            k: v
            for k, v in response.headers.items()
            if k.lower() in {"content-type", "cache-control", "etag"}
        }
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=passthrough_headers,
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
