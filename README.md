# didyar
High-performance Web VMS for multi-channel live CCTV monitoring via HLS. Built with Vanilla JS and HTML5, featuring dynamic grids, PWA integration, state caching, gesture-based zoom, and a seamless dual-stream setup (`hls.txt` for standard preview grid and `mhls.txt` for focused HD stream switching).
## Technical Specifications

* **Core Engine:** HTML5 Media Source Extensions (MSE) integrated with the [Hls.js Engine](https://github.com/video-dev/hls.js/) for seamless `.m3u8` packet parsing.
* **Stream Optimization:** Dual-stream manifest decoupling (`hls.txt` for standard performance grid rendering and `mhls.txt` for high-definition target viewing).
* **State Management:** Fully client-side state maintenance utilizing the browser's `localStorage` API for caching camera snapshots, grid topologies, and user-defined viewport parameters.
* **Mobile Ready (PWA):** Equipped with a comprehensive `manifest.json` specification, configured for standalone app deployment on iOS and Android with customized hardware theme-color mappings.

---

## Core Features and Functionalities

* **Secure Gatekeeper Authentication:** Integrated native login and administrative user registration overlay using cryptographically generated Communication Keys (`crypto.randomUUID`) to validate client sessions.
* **Dynamic Grid Layout Matrix:** Adaptive grid layout controller allowing real-time switching between 1, 2, 4, 8, or 16 cameras per viewport. The interface handles automatic pagination calculations dynamically based on active stream arrays.
* **Camera Grouping Matrix:** Built-in categorization layer filtering streams by designated zones or group names instantly without re-initializing the core streaming instances.
* **Instant Snapshot Caching System:** Captures active frames from live streams and caches them locally as Base64 placeholders to ensure instantaneous, white-screen-free loading states during application boot.
* **Advanced Fullscreen Matrix with Touch Gestures:** Dedicated focus overlay that triggers cross-fading into high-definition streams. Fully customized with native touch event handlers for **Pinch-to-Zoom** and **Pan/Drag** multi-touch manipulations.
* **CCTV Timeline Playback Simulation:** A comprehensive NVR/DVR emulation panel complete with an interactive timeline, draggable playhead tracking, dynamic speed scaling selectors, and visual clip segmentation bounding boxes.

---

## Configuration and Deployment

To configure your video matrix streams, populate the two structured flat-text configuration files located within the project root directory. Do not alter the core codebase logic.

1. **`hls.txt` (Standard Definition / Live Grid Streams):** Open this file and append your low-bandwidth or sub-stream `.m3u8` source URLs, separated by a newline.
2. **`mhls.txt` (High Definition / Focused Overlay Streams):** Open this file and append your corresponding high-resolution main-stream `.m3u8` source URLs, mapped line-for-line to match the order in `hls.txt`.

| Configuration Blueprint | Targeted Stream Utility | Endpoint Mapping Standard |
| :--- | :--- | :--- |
| `hls.txt` | Standard View / Grid Monitoring (SD) | `https://your-server.com/live/camera0_sub.m3u8` |
| `mhls.txt` | High Definition / Fullscreen View (HD) | `https://your-server.com/live/camera0_main.m3u8` |

> **Security Compliance:** The active streaming configurations (`hls.txt`, `mhls.txt`) and localization archives (`*.rar`) are explicitly flagged within the `.gitignore` template to safeguard hardware IP architecture from public exposure.

---

## Local Execution Architecture

Clone the architecture to your local workstation and deploy via an HTTP server environment (such as Nginx, Apache, or the VS Code Live Server extension):

```bash
git clone [https://github.com/your-username/your-repository-name.git](https://github.com/your-username/your-repository-name.git)
cd your-repository-name
