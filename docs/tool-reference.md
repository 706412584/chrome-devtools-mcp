<!-- AUTO GENERATED DO NOT EDIT - run 'npm run gen' to update-->

# Chrome DevTools MCP Tool Reference

- **[Input automation](#input-automation)** (12 tools)
  - [`click`](#click)
  - [`drag`](#drag)
  - [`fill`](#fill)
  - [`fill_form`](#fill_form)
  - [`handle_dialog`](#handle_dialog)
  - [`hover`](#hover)
  - [`keyboard_sequence`](#keyboard_sequence)
  - [`mouse_move`](#mouse_move)
  - [`press_key`](#press_key)
  - [`type_text`](#type_text)
  - [`upload_file`](#upload_file)
  - [`click_at`](#click_at)
- **[Navigation automation](#navigation-automation)** (8 tools)
  - [`browser_connect`](#browser_connect)
  - [`browser_discover`](#browser_discover)
  - [`close_page`](#close_page)
  - [`list_pages`](#list_pages)
  - [`navigate_page`](#navigate_page)
  - [`new_page`](#new_page)
  - [`select_page`](#select_page)
  - [`wait_for`](#wait_for)
- **[Emulation](#emulation)** (2 tools)
  - [`emulate`](#emulate)
  - [`resize_page`](#resize_page)
- **[Performance](#performance)** (5 tools)
  - [`game_stats`](#game_stats)
  - [`inject_game_overlay`](#inject_game_overlay)
  - [`performance_analyze_insight`](#performance_analyze_insight)
  - [`performance_start_trace`](#performance_start_trace)
  - [`performance_stop_trace`](#performance_stop_trace)
- **[Network](#network)** (7 tools)
  - [`asset_monitor_get`](#asset_monitor_get)
  - [`asset_monitor_start`](#asset_monitor_start)
  - [`get_network_request`](#get_network_request)
  - [`list_network_requests`](#list_network_requests)
  - [`websocket_monitor_get`](#websocket_monitor_get)
  - [`websocket_monitor_start`](#websocket_monitor_start)
  - [`websocket_monitor_stop`](#websocket_monitor_stop)
- **[Debugging](#debugging)** (16 tools)
  - [`canvas_info`](#canvas_info)
  - [`console_intercept_start`](#console_intercept_start)
  - [`console_intercept_stop`](#console_intercept_stop)
  - [`console_search`](#console_search)
  - [`console_stats`](#console_stats)
  - [`evaluate_script`](#evaluate_script)
  - [`game_state`](#game_state)
  - [`game_test`](#game_test)
  - [`get_console_message`](#get_console_message)
  - [`lighthouse_audit`](#lighthouse_audit)
  - [`list_console_messages`](#list_console_messages)
  - [`screenshot_diff`](#screenshot_diff)
  - [`take_screenshot`](#take_screenshot)
  - [`take_snapshot`](#take_snapshot)
  - [`screencast_start`](#screencast_start)
  - [`screencast_stop`](#screencast_stop)
- **[Memory](#memory)** (9 tools)
  - [`take_heapsnapshot`](#take_heapsnapshot)
  - [`close_heapsnapshot`](#close_heapsnapshot)
  - [`get_heapsnapshot_class_nodes`](#get_heapsnapshot_class_nodes)
  - [`get_heapsnapshot_details`](#get_heapsnapshot_details)
  - [`get_heapsnapshot_dominators`](#get_heapsnapshot_dominators)
  - [`get_heapsnapshot_edges`](#get_heapsnapshot_edges)
  - [`get_heapsnapshot_retainers`](#get_heapsnapshot_retainers)
  - [`get_heapsnapshot_retaining_paths`](#get_heapsnapshot_retaining_paths)
  - [`get_heapsnapshot_summary`](#get_heapsnapshot_summary)
- **[Extensions](#extensions)** (5 tools)
  - [`install_extension`](#install_extension)
  - [`list_extensions`](#list_extensions)
  - [`reload_extension`](#reload_extension)
  - [`trigger_extension_action`](#trigger_extension_action)
  - [`uninstall_extension`](#uninstall_extension)
- **[Third-party](#third-party)** (2 tools)
  - [`execute_3p_developer_tool`](#execute_3p_developer_tool)
  - [`list_3p_developer_tools`](#list_3p_developer_tools)
- **[WebMCP](#webmcp)** (2 tools)
  - [`execute_webmcp_tool`](#execute_webmcp_tool)
  - [`list_webmcp_tools`](#list_webmcp_tools)

## Input automation

### `click`

**Description:** Clicks on the provided element. For cross-origin iframes (e.g., game canvases), automatically falls back to CDP Input.dispatchMouseEvent which penetrates iframe boundaries. Use offsetX/offsetY to [`click`](#click) at a specific position within the element (e.g., a button inside a canvas). Coordinates are relative to the element's top-left corner.

**Parameters:**

- **uid** (string) **(required)**: The uid of an element on the page from the page content snapshot
- **dblClick** (boolean) _(optional)_: Set to true for double clicks. Default is false.
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.
- **offsetX** (number) _(optional)_: Horizontal offset from the element's top-left corner in CSS pixels. When provided with offsetY, clicks at this position instead of center. Useful for clicking buttons inside canvas elements.
- **offsetY** (number) _(optional)_: Vertical offset from the element's top-left corner in CSS pixels. When provided with offsetX, clicks at this position instead of center. Useful for clicking buttons inside canvas elements.

---

### `drag`

**Description:** [`Drag`](#drag) an element onto another element

**Parameters:**

- **from_uid** (string) **(required)**: The uid of the element to [`drag`](#drag)
- **to_uid** (string) **(required)**: The uid of the element to drop into
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `fill`

**Description:** Type text into an input, text area or select an option from a &lt;select&gt; element.

**Parameters:**

- **uid** (string) **(required)**: The uid of an element on the page from the page content snapshot
- **value** (string) **(required)**: The value to [`fill`](#fill) in. "true" or "false" for checkboxes and toggles, "true" for radio buttons.
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `fill_form`

**Description:** [`Fill`](#fill) out multiple form elements (inputs, selects, checkboxes, radios) at once. ALWAYS prefer this tool over multiple individual '[`fill`](#fill)' or '[`click`](#click)' calls when interacting with forms. It is significantly faster, more reliable, and reduces turn count. Example: [`Fill`](#fill) username, password, and check "Remember Me" in one call.

**Parameters:**

- **elements** (array) **(required)**: Elements from snapshot to [`fill`](#fill) out.
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `handle_dialog`

**Description:** If a browser dialog was opened, use this command to handle it

**Parameters:**

- **action** (enum: "accept", "dismiss") **(required)**: Whether to dismiss or accept the dialog
- **promptText** (string) _(optional)_: Optional prompt text to enter into the dialog.

---

### `hover`

**Description:** [`Hover`](#hover) over the provided element

**Parameters:**

- **uid** (string) **(required)**: The uid of an element on the page from the page content snapshot
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `keyboard_sequence`

**Description:** Press a sequence of keys or key combinations. Each entry can be a single key or a combo like "Control+S". Useful for testing keyboard shortcuts and multi-key game controls.

**Parameters:**

- **keys** (array) **(required)**: Array of keys or key combos to press in order, e.g. ["Tab", "Tab", "Enter"] or ["Control+S", "Control+Z"]
- **delayMs** (number) _(optional)_: Delay between each key press in milliseconds. Default is 0.
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `mouse_move`

**Description:** Move the mouse cursor without clicking. Useful for triggering [`hover`](#hover) states.

**Parameters:**

- **x** (number) **(required)**: The x coordinate
- **y** (number) **(required)**: The y coordinate
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `press_key`

**Description:** Press a key or key combination. Use this when other input methods like [`fill`](#fill)() cannot be used (e.g., keyboard shortcuts, navigation keys, or special key combinations).

**Parameters:**

- **key** (string) **(required)**: A key or a combination (e.g., "Enter", "Control+A", "Control++", "Control+Shift+R"). Modifiers: Control, Shift, Alt, Meta
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `type_text`

**Description:** Type text using keyboard into a previously focused input

**Parameters:**

- **text** (string) **(required)**: The text to type
- **submitKey** (string) _(optional)_: Optional key to press after typing. E.g., "Enter", "Tab", "Escape"

---

### `upload_file`

**Description:** Upload a file through a provided element.

**Parameters:**

- **filePath** (string) **(required)**: The local path of the file to upload
- **uid** (string) **(required)**: The uid of the file input element or an element that will open file chooser on the page from the page content snapshot
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

### `click_at`

**Description:** Clicks at the provided coordinates (requires flag: --experimentalVision=true)

**Parameters:**

- **x** (number) **(required)**: The x coordinate
- **y** (number) **(required)**: The y coordinate
- **dblClick** (boolean) _(optional)_: Set to true for double clicks. Default is false.
- **includeSnapshot** (boolean) _(optional)_: Whether to include a snapshot in the response. Default is false.

---

## Navigation automation

### `browser_connect`

**Description:** Generate the plugin configuration to connect to a specific Chrome instance. Takes a userDataDir path or wsEndpoint and outputs the plugin.json args needed. Use [`browser_discover`](#browser_discover) first to find available instances.

**Parameters:**

- **profile** (string) _(optional)_: Chrome profile name within the userDataDir (e.g., "Default", "Profile 1").
- **userDataDir** (string) _(optional)_: Path to Chrome user data directory to connect to.
- **wsEndpoint** (string) _(optional)_: WebSocket endpoint to connect to (e.g., ws://127.0.0.1:9222/devtools/browser/xxx).

---

### `browser_discover`

**Description:** Discover available Chrome/Edge browser instances and profiles. Finds: (1) Running Chrome instances with debug ports, (2) MCP persistent profiles with saved sessions, system Chrome profiles. Use the returned --userDataDir or --wsEndpoint to reconnect.

**Parameters:** None

---

### `close_page`

**Description:** Closes the page by its index. The last open page cannot be closed.

**Parameters:**

- **pageId** (number) **(required)**: The ID of the page to close. Call [`list_pages`](#list_pages) to list pages.

---

### `list_pages`

**Description:** Get a list of pages open in the browser.

**Parameters:** None

---

### `navigate_page`

**Description:** Go to a URL, or back, forward, or reload. Use project URL if not specified otherwise.

**Parameters:**

- **handleBeforeUnload** (enum: "accept", "decline") _(optional)_: Whether to auto accept or beforeunload dialogs triggered by this navigation. Default is accept.
- **ignoreCache** (boolean) _(optional)_: Whether to ignore cache on reload.
- **initScript** (string) _(optional)_: A JavaScript script to be executed on each new document before any other scripts for the next navigation.
- **timeout** (integer) _(optional)_: Maximum wait time in milliseconds. If set to 0, the default timeout will be used.
- **type** (enum: "url", "back", "forward", "reload") _(optional)_: Navigate the page by URL, back or forward in history, or reload.
- **url** (string) _(optional)_: Target URL (only type=url)

---

### `new_page`

**Description:** Open a new tab and load a URL. Use project URL if not specified otherwise.

**Parameters:**

- **url** (string) **(required)**: URL to load in a new page.
- **background** (boolean) _(optional)_: Whether to open the page in the background without bringing it to the front. Default is false (foreground).
- **isolatedContext** (string) _(optional)_: If specified, the page is created in an isolated browser context with the given name. Pages in the same browser context share cookies and storage. Pages in different browser contexts are fully isolated.
- **timeout** (integer) _(optional)_: Maximum wait time in milliseconds. If set to 0, the default timeout will be used.

---

### `select_page`

**Description:** Select a page as a context for future tool calls.

**Parameters:**

- **pageId** (number) **(required)**: The ID of the page to select. Call [`list_pages`](#list_pages) to get available pages.
- **bringToFront** (boolean) _(optional)_: Whether to focus the page and bring it to the top.

---

### `wait_for`

**Description:** Wait for the specified text to appear on the selected page.

**Parameters:**

- **text** (array) **(required)**: Non-empty list of texts. Resolves when any value appears on the page.
- **timeout** (integer) _(optional)_: Maximum wait time in milliseconds. If set to 0, the default timeout will be used.

---

## Emulation

### `emulate`

**Description:** Emulates various features on the selected page.

**Parameters:**

- **colorScheme** (enum: "dark", "light", "auto") _(optional)_: [`Emulate`](#emulate) the dark or the light mode. Set to "auto" to reset to the default.
- **cpuThrottlingRate** (number) _(optional)_: Represents the CPU slowdown factor. Omit or set the rate to 1 to disable throttling
- **extraHttpHeaders** (string) _(optional)_: Extra HTTP headers as a JSON string object, e.g. {"X-Custom": "value", "Authorization": "Bearer token"}. Headers are included into every HTTP request originating from the page and persist across navigations until cleared. Pass an empty string to clear all extra headers.
- **geolocation** (string) _(optional)_: Geolocation (`&lt;latitude&gt;,&lt;longitude&gt;`) to [`emulate`](#emulate). Latitude between -90 and 90. Longitude between -180 and 180. Omit to clear the geolocation override.
- **networkConditions** (enum: "Offline", "Slow 3G", "Fast 3G", "Slow 4G", "Fast 4G") _(optional)_: Throttle network. Omit to disable throttling.
- **userAgent** (string) _(optional)_: User agent to [`emulate`](#emulate). Set to empty string to clear the user agent override.
- **viewport** (string) _(optional)_: [`Emulate`](#emulate) device viewports '&lt;width&gt;x&lt;height&gt;x&lt;devicePixelRatio&gt;[,mobile][,touch][,landscape]'. 'touch' and 'mobile' to [`emulate`](#emulate) mobile devices. 'landscape' to [`emulate`](#emulate) landscape mode.

---

### `resize_page`

**Description:** Resizes the selected page's window so that the page has specified dimension

**Parameters:**

- **height** (number) **(required)**: Page height
- **width** (number) **(required)**: Page width

---

## Performance

### `game_stats`

**Description:** Measure real-time game performance: FPS, frame time percentiles (avg/min/max/p50/p95/p99), and JS memory usage. Collects data via requestAnimationFrame sampling for the specified duration. Returns JSON with performance metrics.

**Parameters:**

- **durationMs** (integer) _(optional)_: Duration in milliseconds to collect frame samples. Default 1000ms. Range 100-5000.
- **maxSamples** (integer) _(optional)_: Maximum number of frame samples to collect. Default 120.

---

### `inject_game_overlay`

**Description:** Inject or remove a real-time FPS/frame-time/memory overlay on the page. The overlay is a semi-transparent HUD in the top-right corner showing live performance metrics.

**Parameters:**

- **action** (enum: "start", "stop") **(required)**: "start" to inject the overlay, "stop" to remove it.

---

### `performance_analyze_insight`

**Description:** Provides more detailed information on a specific Performance Insight of an insight set that was highlighted in the results of a trace recording.

**Parameters:**

- **insightName** (string) **(required)**: The name of the Insight you want more information on. For example: "DocumentLatency" or "LCPBreakdown"
- **insightSetId** (string) **(required)**: The id for the specific insight set. Only use the ids given in the "Available insight sets" list.

---

### `performance_start_trace`

**Description:** Start a performance trace on the selected webpage. Use to find frontend performance issues, Core Web Vitals (LCP, INP, CLS), and improve page load speed.

**Parameters:**

- **autoStop** (boolean) _(optional)_: Determines if the trace recording should be automatically stopped.
- **filePath** (string) _(optional)_: The absolute file path, or a file path relative to the current working directory, to save the raw trace data. For example, trace.json.gz (compressed) or trace.json (uncompressed).
- **reload** (boolean) _(optional)_: Determines if, once tracing has started, the current selected page should be automatically reloaded. Navigate the page to the right URL using the [`navigate_page`](#navigate_page) tool BEFORE starting the trace if reload or autoStop is set to true.

---

### `performance_stop_trace`

**Description:** Stop the active performance trace recording on the selected webpage.

**Parameters:**

- **filePath** (string) _(optional)_: The absolute file path, or a file path relative to the current working directory, to save the raw trace data. For example, trace.json.gz (compressed) or trace.json (uncompressed).

---

## Network

### `asset_monitor_get`

**Description:** Query captured asset loading data. Returns summary by file extension (count, size, duration, failures) and recent entries.

**Parameters:**

- **filter** (string) _(optional)_: Filter by URL substring (case-insensitive).
- **maxResults** (integer) _(optional)_: Maximum recent entries to return. Default 30.
- **sinceMs** (integer) _(optional)_: Only return entries from the last N milliseconds.

---

### `asset_monitor_start`

**Description:** Install an asset loading interceptor that tracks fetch, XHR, and PerformanceObserver resource timing. Use [`asset_monitor_get`](#asset_monitor_get) to query captured data. Covers textures, audio, scripts, 3D models, fonts, WASM.

**Parameters:** None

---

### `get_network_request`

**Description:** Gets a network request by an optional reqid, if omitted returns the currently selected request in the DevTools Network panel.

**Parameters:**

- **reqid** (number) _(optional)_: The reqid of the network request. If omitted returns the currently selected request in the DevTools Network panel.
- **requestFilePath** (string) _(optional)_: The absolute or relative path to a .network-request file to save the request body to. If omitted, the body is returned inline.
- **responseFilePath** (string) _(optional)_: The absolute or relative path to a .network-response file to save the response body to. If omitted, the body is returned inline.

---

### `list_network_requests`

**Description:** List all requests for the currently selected page since the last navigation.

**Parameters:**

- **includePreservedRequests** (boolean) _(optional)_: Set to true to return the preserved requests over the last 3 navigations.
- **pageIdx** (integer) _(optional)_: Page number to return (0-based). When omitted, returns the first page.
- **pageSize** (integer) _(optional)_: Maximum number of requests to return. When omitted, returns all requests.
- **resourceTypes** (array) _(optional)_: Filter requests to only return requests of the specified resource types. When omitted or empty, returns all requests.

---

### `websocket_monitor_get`

**Description:** Get captured WebSocket events. Returns lifecycle events (created, handshake, closed) and message frames.

**Parameters:**

- **maxEvents** (integer) _(optional)_: Maximum number of events to return. Default 50.
- **types** (array) _(optional)_: Filter by event types. When omitted, returns all events.

---

### `websocket_monitor_start`

**Description:** Start monitoring WebSocket activity on the page via CDP Network domain. Captures: connection creation, handshake, frames sent/received, and closures. Call [`websocket_monitor_stop`](#websocket_monitor_stop) to detach. Events are stored in memory and can be queried with [`websocket_monitor_get`](#websocket_monitor_get).

**Parameters:** None

---

### `websocket_monitor_stop`

**Description:** Stop WebSocket monitoring and detach CDP Network listeners.

**Parameters:** None

---

## Debugging

### `canvas_info`

**Description:** Get information about all canvas elements on the page: dimensions, DPR, WebGL context details, GPU renderer. Useful for debugging game rendering across different devices.

**Parameters:** None

---

### `console_intercept_start`

**Description:** Install a console interceptor that captures all console.log/info/warn/error/debug calls into a buffer. Use [`console_search`](#console_search) to query captured messages. Messages persist until page navigation or [`console_intercept_stop`](#console_intercept_stop).

**Parameters:** None

---

### `console_intercept_stop`

**Description:** Clear the console capture buffer. Does not uninstall the interceptor (messages will continue to be captured).

**Parameters:** None

---

### `console_search`

**Description:** Search captured console messages by text content and/or type. Requires [`console_intercept_start`](#console_intercept_start) to be called first to install the interceptor. Returns matching messages with timestamps.

**Parameters:**

- **maxResults** (integer) _(optional)_: Maximum number of messages to return. Default 50.
- **query** (string) _(optional)_: Text to search for (case-insensitive substring match).
- **sinceMs** (integer) _(optional)_: Only return messages from the last N milliseconds. Default: all messages.
- **types** (string) _(optional)_: Comma-separated list of message types to filter: log,info,warn,error,debug,dir,table,trace. Default: all types.

---

### `console_stats`

**Description:** Show statistics about captured console messages: total count, breakdown by type, time range.

**Parameters:** None

---

### `evaluate_script`

**Description:** Evaluate a JavaScript function inside the currently selected page. Returns the response as JSON,
so returned values have to be JSON-serializable.

**Parameters:**

- **function** (string) **(required)**: A JavaScript function declaration to be executed by the tool in the currently selected page.
Example without arguments: `() => {
  return document.title
}` or `async () => {
  return await fetch("example.com")
}`.
Example with arguments: `(el) => {
  return el.innerText;
}`

- **args** (array) _(optional)_: An optional list of arguments to pass to the function.
- **dialogAction** (string) _(optional)_: Handle dialogs while execution. "accept", "dismiss", or string for response of window.prompt. Defaults to accept.
- **filePath** (string) _(optional)_: The absolute or relative path to a file to save the script output to. If omitted, the output is returned inline.

---

### `game_state`

**Description:** Inspect game internal state. Supports presets: "screen" (current page/screen), "dom" (DOM element counts), "console" (game framework globals), "performance" (resource stats). Or provide a custom JavaScript function to read any game variable.

**Parameters:**

- **function** (string) _(optional)_: Custom JavaScript function to evaluate. Must return a JSON-serializable value. Example: "() => window.__gameState"
- **preset** (enum: "screen", "dom", "console", "performance") _(optional)_: Built-in query preset. If provided, "function" is ignored.
- **pretty** (boolean) _(optional)_: Pretty-print the JSON output. Default true.

---

### `game_test`

**Description:** Run an automated game test with multiple steps. Supports: navigate, wait, [`wait_for`](#wait_for), wait_for_canvas, [`click`](#click), screenshot (with baseline comparison), eval (run JS), assert_text, assert_no_errors. Steps execute sequentially. Screenshots can compare against baselines with pixel tolerance for animated content.

**Parameters:**

- **steps** (string) **(required)**: JSON array of test steps. Each step: {action, url?, name?, text?, function?, present?, x?, y?, timeMs?, timeout?, format?, quality?, baseline?, tolerance?, threshold?}. Actions: navigate, wait, [`wait_for`](#wait_for), wait_for_canvas, [`click`](#click), screenshot, eval, assert_text, assert_no_errors.
- **baselineDir** (string) _(optional)_: Directory to store baseline screenshots for comparison. Defaults to ./test-baselines/

---

### `get_console_message`

**Description:** Gets a console message by its ID. You can get all messages by calling [`list_console_messages`](#list_console_messages).

**Parameters:**

- **msgid** (number) **(required)**: The msgid of a console message on the page from the listed console messages

---

### `lighthouse_audit`

**Description:** Get Lighthouse score and reports for accessibility, SEO, best practices, and agentic browsing. This excludes performance. For performance audits, run [`performance_start_trace`](#performance_start_trace)

**Parameters:**

- **device** (enum: "desktop", "mobile") _(optional)_: Device to [`emulate`](#emulate).
- **mode** (enum: "navigation", "snapshot") _(optional)_: "navigation" reloads &amp; audits. "snapshot" analyzes current state.
- **outputDirPath** (string) _(optional)_: Directory for reports. If omitted, uses temporary files.

---

### `list_console_messages`

**Description:** List all console messages for the currently selected page since the last navigation.

**Parameters:**

- **includePreservedMessages** (boolean) _(optional)_: Set to true to return the preserved messages over the last 3 navigations.
- **pageIdx** (integer) _(optional)_: Page number to return (0-based). When omitted, returns the first page.
- **pageSize** (integer) _(optional)_: Maximum number of messages to return. When omitted, returns all messages.
- **serviceWorkerId** (string) _(optional)_: Filter messages to only return messages of the specified service worker.
- **types** (array) _(optional)_: Filter messages to only return messages of the specified resource types. When omitted or empty, returns all messages.

---

### `screenshot_diff`

**Description:** Compare the current viewport screenshot against a baseline image file. Returns pixel-level diff statistics including diff percentage, max color distance, and bounding boxes of changed regions. Optionally saves a diff visualization image. Useful for automated game UI regression testing and animation frame comparison.

**Parameters:**

- **baselinePath** (string) **(required)**: Path to the baseline (reference) image file to compare against.
- **alphaTolerance** (number) _(optional)_: Alpha channel tolerance (0-255). Useful when compositing causes alpha differences. Default 50.
- **maxRegions** (integer) _(optional)_: Maximum number of diff regions to report. Default 5.
- **saveDiffTo** (string) _(optional)_: Path to save the diff visualization image (PNG). Red pixels show differences, gray pixels show matches.
- **tolerance** (number) _(optional)_: Per-pixel color distance tolerance (Euclidean in RGB space, 0-765). 0 = exact match, 30 = slight anti-aliasing allowed, 100 = aggressive tolerance for animations. Default 30.

---

### `take_screenshot`

**Description:** Take a screenshot of the page or element.

**Parameters:**

- **filePath** (string) _(optional)_: The absolute path, or a path relative to the current working directory, to save the screenshot to instead of attaching it to the response.
- **format** (enum: "png", "jpeg", "webp") _(optional)_: Type of format to save the screenshot as. Default is "png". Use "jpeg" or "webp" with quality for smaller files.
- **fullPage** (boolean) _(optional)_: If set to true takes a screenshot of the full page instead of the currently visible viewport. Incompatible with uid.
- **maxHeight** (integer) _(optional)_: Maximum height in pixels. The screenshot will be downscaled to fit within this height while preserving aspect ratio.
- **maxWidth** (integer) _(optional)_: Maximum width in pixels. The screenshot will be downscaled to fit within this width while preserving aspect ratio. Useful for reducing file size.
- **quality** (number) _(optional)_: Compression quality for JPEG and WebP formats (0-100). Higher values mean better quality but larger file sizes. Ignored for PNG format. Recommended: 80 for JPEG, 85 for WebP.
- **uid** (string) _(optional)_: The uid of an element on the page from the page content snapshot. If omitted, takes a page screenshot.

---

### `take_snapshot`

**Description:** Take a text snapshot of the currently selected page based on the a11y tree. The snapshot lists page elements along with a unique
identifier (uid). Always use the latest snapshot. Prefer taking a snapshot over taking a screenshot. The snapshot indicates the element selected
in the DevTools Elements panel (if any).

**Parameters:**

- **filePath** (string) _(optional)_: The absolute path, or a path relative to the current working directory, to save the snapshot to instead of attaching it to the response.
- **verbose** (boolean) _(optional)_: Whether to include all possible information available in the full a11y tree. Default is false.

---

### `screencast_start`

**Description:** Starts recording a screencast (video) of the selected page in specified format. (requires flag: --experimentalScreencast=true)

**Parameters:**

- **filePath** (string) _(optional)_: Output file path (.webm,.mp4 are supported). Uses mkdtemp to generate a unique path if not provided.

---

### `screencast_stop`

**Description:** Stops the active screencast recording on the selected page. (requires flag: --experimentalScreencast=true)

**Parameters:** None

---

## Memory

### `take_heapsnapshot`

**Description:** Capture a heap snapshot of the currently selected page. Use to analyze the memory distribution of JavaScript objects and debug memory leaks.

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to save the heapsnapshot to.

---

### `close_heapsnapshot`

**Description:** Closes a previously loaded memory heapsnapshot, freeing its memory. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to the .heapsnapshot file to close.

---

### `get_heapsnapshot_class_nodes`

**Description:** Loads a memory heapsnapshot and returns instances of a specific class with their IDs. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to read.
- **id** (number) **(required)**: The ID for the class, obtained from details.
- **pageIdx** (number) _(optional)_: The page index for pagination.
- **pageSize** (number) _(optional)_: The page size for pagination.

---

### `get_heapsnapshot_details`

**Description:** Loads a memory heapsnapshot and returns all available information including statistics, static data, and aggregated node information. Supports pagination for aggregates. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to read.
- **pageIdx** (number) _(optional)_: The page index for pagination of aggregates.
- **pageSize** (number) _(optional)_: The page size for pagination of aggregates.

---

### `get_heapsnapshot_dominators`

**Description:** Loads a memory heapsnapshot and returns the dominator chain for a specific node ID. This helps to identify which objects are keeping the target node alive. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to read.
- **nodeId** (number) **(required)**: The node ID to get the dominator chain for.

---

### `get_heapsnapshot_edges`

**Description:** Loads a memory heapsnapshot and returns outgoing edges (references) for a specific node ID. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to read.
- **nodeId** (number) **(required)**: The node ID to get outgoing edges for.
- **pageIdx** (number) _(optional)_: The page index for pagination.
- **pageSize** (number) _(optional)_: The page size for pagination.

---

### `get_heapsnapshot_retainers`

**Description:** Loads a memory heapsnapshot and returns retainers for a specific node ID. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to read.
- **nodeId** (number) **(required)**: The node ID to get retainers for.
- **pageIdx** (number) _(optional)_: The page index for pagination.
- **pageSize** (number) _(optional)_: The page size for pagination.

---

### `get_heapsnapshot_retaining_paths`

**Description:** Loads a memory heapsnapshot and returns retaining paths for a specific node ID. This helps to understand why a node is not being garbage collected. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to read.
- **nodeId** (number) **(required)**: The node ID to get retaining paths for.
- **maxDepth** (number) _(optional)_: The maximum depth to search for retaining paths.
- **maxNodes** (number) _(optional)_: The maximum number of nodes to return.
- **maxSiblings** (number) _(optional)_: The maximum number of siblings to return.

---

### `get_heapsnapshot_summary`

**Description:** Loads a memory heapsnapshot and returns snapshot summary stats. (requires flag: --memoryDebugging=true)

**Parameters:**

- **filePath** (string) **(required)**: A path to a .heapsnapshot file to read.

---

## Extensions

> NOTE: The Extensions category is not active by default. Use the '--categoryExtensions' flag.

### `install_extension`

**Description:** Installs a Chrome extension from the given path. (requires flag: --categoryExtensions=true)

**Parameters:**

- **path** (string) **(required)**: Absolute path to the unpacked extension folder.

---

### `list_extensions`

**Description:** Lists all the Chrome extensions installed in the browser. This includes their name, ID, version, and enabled status. (requires flag: --categoryExtensions=true)

**Parameters:** None

---

### `reload_extension`

**Description:** Reloads an unpacked Chrome extension by its ID. (requires flag: --categoryExtensions=true)

**Parameters:**

- **id** (string) **(required)**: ID of the extension to reload.

---

### `trigger_extension_action`

**Description:** Triggers the default action of an extension by its ID. (requires flag: --categoryExtensions=true)

**Parameters:**

- **id** (string) **(required)**: ID of the extension to trigger the action for.

---

### `uninstall_extension`

**Description:** Uninstalls a Chrome extension by its ID. (requires flag: --categoryExtensions=true)

**Parameters:**

- **id** (string) **(required)**: ID of the extension to uninstall.

---

## Third-party

> NOTE: The Third-party category is not active by default. Use the '--categoryExperimentalThirdParty' flag.

### `execute_3p_developer_tool`

**Description:** Executes a tool exposed by the page. (requires flag: --categoryExperimentalThirdParty=true)

**Parameters:**

- **toolName** (string) **(required)**: The name of the tool to execute
- **params** (string) _(optional)_: The JSON-stringified parameters to pass to the tool

---

### `list_3p_developer_tools`

**Description:** Lists all third-party developer tools the page exposes for providing runtime information.
  Third-party developer tools can be called via the '[`execute_3p_developer_tool`](#execute_3p_developer_tool)()' MCP tool.
  Alternatively, third-party developer tools can be executed by calling '[`evaluate_script`](#evaluate_script)' and adding the
  following command to the script:
  'window.__dtmcp.executeTool(toolName, params)'
  This might be helpful when the third-party developer tools return non-serializable values or when composing
  third-party developer tools with additional functionality. (requires flag: --categoryExperimentalThirdParty=true)

**Parameters:** None

---

## WebMCP

> NOTE: The WebMCP category is not active by default. Use the '--categoryExperimentalWebmcp' flag.

### `execute_webmcp_tool`

**Description:** Executes a WebMCP tool exposed by the page. (requires flag: --categoryExperimentalWebmcp=true)

**Parameters:**

- **toolName** (string) **(required)**: The name of the WebMCP tool to execute
- **input** (string) _(optional)_: The JSON-stringified parameters to pass to the WebMCP tool

---

### `list_webmcp_tools`

**Description:** Lists all WebMCP tools the page exposes. (requires flag: --categoryExperimentalWebmcp=true)

**Parameters:** None

---
