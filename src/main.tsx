import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { bootstrapGoogleH5Ads } from "./integrations/ads/googleH5Ads"
import "./index.css"

void bootstrapGoogleH5Ads()
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
