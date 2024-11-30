import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Setup() {
  const [customKnowledge, setCustomKnowledge] = useState("");
  const [yourName, setYourName] = useState("");
  const [testCode03, setTestCode03] = useState("");
  const [testCode04, setTestCode04] = useState("");
  const [testCode05, setTestCode05] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchTestCodes = async () => {
      try {
        const response = await fetch("http://localhost:8000/setup/test-code", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setCustomKnowledge(data.test_code_01);
          setYourName(data.test_code_02);
          setTestCode03(data.test_code_03);
          setTestCode04(data.test_code_04);
          setTestCode05(data.test_code_05);
        } else {
          setError("Failed to fetch data");
        }
      } catch (err) {
        setError("Error fetching data");
      }
    };

    fetchTestCodes();
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch("http://localhost:8000/setup/test-code", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          test_code_01: customKnowledge,
          test_code_02: yourName,
          test_code_03: testCode03,
          test_code_04: testCode04,
          test_code_05: testCode05,
        }),
      });
      if (!response.ok) {
        setError("Failed to save data");
        return;
      }
      router.push("/"); // Navigate to the main SPA
    } catch (err) {
      setError("Error saving data");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Setup Your Information</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="bg-white p-8 rounded shadow-md w-96"
      >
        {/* Custom Knowledge */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Custom Knowledge
          </label>
          <textarea
            value={customKnowledge}
            onChange={(e) => setCustomKnowledge(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded mt-1 h-24 resize-none"
            placeholder="Add any custom knowledge you'd like to share..."
          />
        </div>

        {/* Your Name */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Your Name/What Your Peers Call You
          </label>
          <input
            type="text"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            placeholder="e.g., Alex, Max, etc."
          />
        </div>

        {/* Other Test Codes */}
        {["Test Code 03", "Test Code 04", "Test Code 05"].map((label, index) => {
          const values = [testCode03, testCode04, testCode05];
          const setters = [setTestCode03, setTestCode04, setTestCode05];
          return (
            <div className="mb-4" key={index}>
              <label className="block text-gray-700 font-medium mb-2">
                {label}
              </label>
              <input
                type="text"
                value={values[index]}
                onChange={(e) => setters[index](e.target.value)}
                className="w-full p-2 border border-gray-300 rounded mt-1"
              />
            </div>
          );
        })}

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Save and Continue
        </button>
      </form>
    </div>
  );
}
