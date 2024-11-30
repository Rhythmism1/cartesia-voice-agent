import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      // Forward the login request to your Python backend
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data); // Return backend response to the frontend
      } else {
        const errorData = await response.json();
        return res.status(response.status).json({ message: errorData.detail || "Login failed" });
      }
    } catch (error) {
      console.error("Login API error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
