import { useState } from "react";
import { useRouter } from "next/router";

export default function LoginOrRegister() {
  const [isRegister, setIsRegister] = useState(false); // Toggle between login and register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const endpoint = isRegister ? "/api/register" : "/api/login";

    try {
      // Send login or register request
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (isRegister) {
          setSuccess(data.message);
        } else {
          // Store token after login
          const token = data.access_token;
          localStorage.setItem("token", token);

          // Fetch the user's test code
          const testCodeResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/setup/test-code`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (testCodeResponse.ok) {
            const testCodeData = await testCodeResponse.json();
            if (testCodeData.test_code === "") {
              router.push("/setup"); // Redirect to setup page if no test code is set
            } else {
              router.push("/"); // Redirect to main SPA
            }
          } else {
            const errorText = await testCodeResponse.text(); // Fetch the error text
            console.error("Test Code Fetch Error:", errorText);
            setError("Failed to fetch test code. Please try again.");
          }
        }
      } else {
        const data = await response.json();
        setError(data.detail || "An error occurred");
      }
    } catch (err) {
      console.error("Submission Error:", err);
      setError("An error occurred during submission");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">
        {isRegister ? "Register" : "Login"}
      </h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {success && <p className="text-green-500 mb-4">{success}</p>}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-80"
      >
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-gray-700 font-medium"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          {isRegister ? "Register" : "Login"}
        </button>
      </form>
      <button
        onClick={() => setIsRegister(!isRegister)}
        className="mt-4 text-blue-500 underline"
      >
        {isRegister
          ? "Already have an account? Login"
          : "Don't have an account? Register"}
      </button>
    </div>
  );
}
