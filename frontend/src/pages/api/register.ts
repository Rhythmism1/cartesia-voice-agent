import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      // Forward the request to the FastAPI backend
      const response = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      if (response.ok) {
        const data = await response.json();
        res.status(200).json(data); // Return the response from the backend
      } else {
        const errorData = await response.json();
        res.status(response.status).json({
          detail: errorData.detail || "Registration failed",
        });
      }
    } catch (error) {
      console.error("Error in /api/register:", error);
      res.status(500).json({ detail: "Internal server error" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ detail: `Method ${req.method} Not Allowed` });
  }
}
