const express = require("express");
const cors = require("cors");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Initialize OpenAI API client
const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Setup multer for file uploads
const upload = multer({ dest: "uploads/" });

// Middleware
// app.use(cors());
const corsConfig = {
  origin: "",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};
app.use(cors(corsConfig));
app.options("", cors(corsConfig));

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const contents = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => {
        const content = row["Contents"]; // Assuming 'Contents' is the column name
        contents.push(content);
      })
      .on("end", () => {
        resolve(contents);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

async function generateTopics(contents, numTopics) {
  try {
    let prompt = `Generate ${numTopics} relevant topics from the provided text:\n\n`;
    prompt += contents.join("\n\n").substring(0, 4000);
    // console.log("Prompt:", prompt); // Limit prompt length to 4000 characters
    const response = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt: prompt,
      max_tokens: 200, // Reduce max_tokens to fit within the maximum context length
      temperature: 0.5,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const topics = response?.choices[0]?.text;

    return topics;
  } catch (error) {
    console.error("Error generating topics:", error);
    throw error;
  }
}

// function extractTopics(choices) {
//   const topics = choices?.map((choice) => choice.text.trim());
//   return topics;
// }

app.post("/process-csv", upload.single("csvFile"), async (req, res) => {
  const numTopics = req.body.numTopics;

  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const contents = await readCSV(filePath);
    const topics = await generateTopics(contents, numTopics);

    // Delete the uploaded file after processing
    fs.unlinkSync(filePath);

    // Send generated topics as response
    res.json({ topics }); // Send topics as JSON object
  } catch (error) {
    console.error("Error processing CSV:", error);
    res.status(500).json({ error: "Failed to process CSV" });
  }
});

app.get("/", (req, res) => {
  res.send("Refugee server is running");
});

app.listen(port, () => {
  console.log(`Refugee server is running on port ${port}`);
});
