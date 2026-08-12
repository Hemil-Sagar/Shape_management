const env = require("./config/env")
const { connectDB } = require("./db")
const createApp = require("./app")

async function start() {
  try {
    await connectDB()

    const app = createApp()
    app.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port}`)
    })
  } catch (err) {
    console.error("Failed to connect", err)
    process.exit(1)
  }
}
start()