import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/router";

const Setup = () => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [testCode, setTestCode] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch current test code
  useEffect(() => {
    const fetchTestCode = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/setup/test-code`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setTestCode(data.test_code || "");
        }
      } catch (error) {
        console.error("Failed to fetch test code:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTestCode();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/setup/test-code`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ test_code: testCode }),
      });

      if (!response.ok) {
        throw new Error("Failed to update test code");
      }

      alert("Test code saved successfully!");
      router.push("/"); // Redirect to the SPA with the chatbot
    } catch (error) {
      console.error("Failed to update test code:", error);
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="setup-container">
      <h1>Setup</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="test-code">Test Code:</label>
        <input
          id="test-code"
          type="text"
          value={testCode}
          onChange={(e) => setTestCode(e.target.value)}
          placeholder="Enter your test code"
        />
        <button type="submit">Save</button>
      </form>
    </div>
  );
};

export default Setup;
