import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      // Extract the token from the Authorization header
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Missing token" });
      }

      // Validate the token with the backend
      const response = await fetch("http://localhost:8000/auth", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data); // Forward valid token data to the frontend
      } else {
        const errorData = await response.json();
        return res.status(response.status).json({
          message: errorData.detail || "Invalid or expired token",
        });
      }
    } catch (error) {
      console.error("Auth API error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
