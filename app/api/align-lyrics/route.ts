export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const prompt = formData.get("prompt");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    if (prompt) {
      pythonFormData.append("prompt", prompt.toString());
    }

    const pythonResponse = await fetch("http://localhost:8000/transcribe", {
      method: "POST",
      body: pythonFormData,
    });

    if (!pythonResponse.ok) {
      throw new Error("Failed to process audio in container");
    }

    const data = await pythonResponse.json();
    return Response.json(data);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
