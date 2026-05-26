(function () {
  "use strict";

  const elements = {
    frame: document.getElementById("diagramFrame"),
    viewport: document.getElementById("diagramViewport"),
    stage: document.getElementById("diagramStage"),
    svg: document.getElementById("connectionLayer"),
    labelSvg: document.getElementById("labelLayer"),
    frameTechLinks: document.getElementById("frameTechLinkLayer"),
    groups: document.getElementById("groupLayer"),
    nodes: document.getElementById("nodesLayer"),
    activeNodes: document.getElementById("activeNodesLayer"),
    techStrip: document.querySelector(".technology-strip"),
    techButtons: document.querySelectorAll("[data-tech]"),
    status: document.getElementById("statusText")
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const palette = {
    physical: { hex: "#b56b1d", rgb: "181, 107, 29" },
    capture: { hex: "#238997", rgb: "35, 137, 151" },
    pipeline: { hex: "#5b7bc4", rgb: "91, 123, 196" },
    ai: { hex: "#8d63a8", rgb: "141, 99, 168" },
    output: { hex: "#4b9272", rgb: "75, 146, 114" },
    flow: { hex: "#258f88", rgb: "37, 143, 136" },
    branch: { hex: "#5878c6", rgb: "88, 120, 198" },
    feedback: { hex: "#8d63a8", rgb: "141, 99, 168" }
  };

  const connectionPalette = {
    main: palette.flow,
    branch: palette.branch,
    mcp: palette.feedback,
    feedback: palette.feedback
  };

  const groups = [
    { id: "physical", title: "Physical Interaction", componentIds: ["human", "device"], color: palette.physical },
    { id: "capture", title: "Linux Capture Environment", componentIds: ["host", "capture", "captureFile"], color: palette.capture },
    { id: "pipeline", title: "BSU Processing Pipeline", componentIds: ["reader", "decoder", "events", "analysis"], color: palette.pipeline },
    { id: "ai", title: "AI-Assisted Workflow", componentIds: ["mcp", "assistant", "output"], color: palette.ai }
  ];

  const components = [
    {
      id: "human",
      group: "physical",
      name: "Human User",
      title: "Experiment driver and validator",
      note: "Acts on the device, provides context, and validates findings.",
      description: "Performs physical device actions, supplies experiment context, and validates AI-assisted findings."
    },
    {
      id: "device",
      group: "physical",
      name: "USB Device",
      title: "Target protocol source",
      note: "Vendor-specific hardware whose behavior is observed through USB traffic.",
      description: "The hardware being analyzed, often using a vendor-specific or poorly documented USB protocol."
    },
    {
      id: "host",
      group: "capture",
      name: "Linux Host",
      title: "Capture workstation",
      note: "Hosts the device, records USB traffic, and runs the BSU analysis workflow.",
      description: "Acts as the Linux USB host and analysis workstation for the capture workflow."
    },
    {
      id: "capture",
      group: "capture",
      name: "usbmon / tshark Capture",
      title: "Capture and pcap-ng export",
      note: "Observes Linux USB traffic and saves it as pcap-ng evidence.",
      description: "Captures Linux USB communication through usbmon-facing tooling and stores it as pcap-ng evidence for BSU."
    },
    {
      id: "captureFile",
      group: "capture",
      name: "pcap-ng Capture File",
      title: "Recorded USB communication",
      note: "Saves the captured USB exchange as a pcap-ng file that BSU can reload and decode.",
      description: "Stores recorded USB communication data in a pcap-ng capture file for repeatable BSU analysis."
    },
    {
      id: "reader",
      group: "pipeline",
      name: "pcap-ng Block Reader",
      title: "Reads capture blocks",
      note: "Parses pcap-ng blocks and raw packet bytes.",
      description: "Loads recorded USB traffic by parsing pcap-ng block structure before USB-specific decoding."
    },
    {
      id: "decoder",
      group: "pipeline",
      name: "URB Decoder",
      title: "USB request decoder",
      note: "Turns usbmon packets into URB records and key fields.",
      description: "Decodes USB Request Blocks from captured packet bytes into fields useful for protocol analysis."
    },
    {
      id: "events",
      group: "pipeline",
      name: "Capture Session Model",
      title: "Decoded capture state",
      note: "Holds decoded URBs, device activity, metadata, and markers.",
      description: "Converts decoded USB traffic into an in-memory capture session that later tools can query."
    },
    {
      id: "analysis",
      group: "pipeline",
      name: "Analysis Query Layer",
      title: "MCP query context",
      note: "Prepares evidence for MCP queries.",
      description: "Organizes decoded capture state into structured query results for human and AI-assisted interpretation."
    },
    {
      id: "output",
      group: "ai",
      name: "Human-Readable Output",
      title: "AI-authored findings",
      note: "Claude writes summaries, protocol notes, experiment suggestions, and review reports.",
      description: "AI-generated human-readable summaries, protocol notes, next-step suggestions, and reports based on BSU tool results."
    },
    {
      id: "mcp",
      group: "ai",
      name: "MCP Tool Interface",
      title: "FastMCP stdio server",
      note: "Runs bsu-tool MCP so Claude can load, mark, and query evidence.",
      description: "Exposes capture loading, decoded session state, markers, and analysis queries through MCP."
    },
    {
      id: "assistant",
      group: "ai",
      name: "AI Assistant / Claude",
      title: "Tool-assisted interpreter",
      note: "Uses BSU tools to inspect evidence, explain hypotheses, and propose follow-up tests.",
      description: "Calls BSU tools, interprets USB device behavior, and suggests follow-up experiments."
    }
  ];

  const connections = [
    { id: "human-device", from: "human", to: "device", label: "physical action", kind: "main", text: "The human user performs a meaningful action on the USB device." },
    { id: "device-host", from: "device", to: "host", label: "observed USB traffic", kind: "main", text: "The device communicates with the Linux host over USB." },
    { id: "host-capture", from: "host", to: "capture", label: "usbmon capture", kind: "main", text: "Linux capture tooling records host-side USB traffic." },
    { id: "capture-file", from: "capture", to: "captureFile", label: "write pcap-ng", kind: "main", text: "tshark/capture tooling saves the recorded traffic as a pcap-ng evidence file." },
    { id: "file-reader", from: "captureFile", to: "reader", label: "read pcap-ng blocks", kind: "main", text: "BSU reads pcap-ng block structure and extracts packet records." },
    { id: "reader-decoder", from: "reader", to: "decoder", label: "decode usbmon payloads", kind: "main", text: "BSU decodes usbmon packet payloads into useful URB fields." },
    { id: "decoder-events", from: "decoder", to: "events", label: "build capture session", kind: "main", text: "Decoded URBs become structured capture state with metadata, devices, and markers." },
    { id: "events-analysis", from: "events", to: "analysis", label: "prepare query context", kind: "main", text: "BSU prepares structured evidence and marker-aware context for tool queries." },
    { id: "analysis-mcp", from: "analysis", to: "mcp", label: "expose tools", kind: "main", text: "BSU exposes capture loading, marker, and query functions through the MCP interface." },
    { id: "mcp-ai", from: "mcp", to: "assistant", label: "MCP tool calls", kind: "mcp", bidirectional: true, text: "The AI assistant calls BSU MCP tools and receives structured analysis results." },
    { id: "assistant-output", from: "assistant", to: "output", label: "write findings", kind: "mcp", text: "Claude turns BSU tool results into human-readable findings." },
    { id: "output-human", from: "output", to: "human", label: "review report", kind: "feedback", text: "The human user reviews AI-authored summaries, notes, and suggested follow-up experiments." },
    { id: "ai-human", from: "assistant", to: "human", label: "explain / propose tests", kind: "feedback", text: "The AI assistant explains behavior and suggests follow-up experiments." },
    { id: "human-ai", from: "human", to: "assistant", label: "context / validation", kind: "feedback", text: "The human user provides context and validates findings against real device behavior." }
  ];

  const componentById = Object.fromEntries(components.map((component) => [component.id, component]));
  const groupById = Object.fromEntries(groups.map((group) => [group.id, group]));

  const technologyTargets = {
    linux: { label: "Linux", targets: ["host", "capture"] },
    usbmon: { label: "usbmon", targets: ["capture"] },
    pcapng: { label: "pcap-ng", targets: ["captureFile", "reader"] },
    urbs: { label: "USB Request Blocks / URBs", targets: ["decoder", "events"] },
    tshark: { label: "tshark / pcap-ng export", targets: ["capture", "captureFile"] },
    mcp: { label: "MCP / Model Context Protocol", targets: ["mcp", "assistant"] },
    fastmcp: { label: "FastMCP stdio server", targets: ["mcp"] },
    claude: { label: "AI coding assistant / Claude", targets: ["assistant", "output"] },
    python: { label: "Python 3.11+ runtime", targets: ["reader", "decoder", "events", "analysis", "mcp"] },
    cli: { label: "bsu-tool CLI entrypoint", targets: ["reader", "mcp"] },
    sdks: { label: "mcp Python SDK", targets: ["mcp"] },
    dataclasses: { label: "Python dataclasses / typed models", targets: ["reader", "events", "analysis"] },
    quality: { label: "pytest / pyright / ruff", targets: ["reader", "decoder", "events", "mcp"] },
    structured: { label: "Structured MCP tool results", targets: ["analysis", "mcp", "assistant", "output"] }
  };

  const FLOW_STEP_MS = 2300;

  class ArchitectureDiagram {
    constructor(dom) {
      this.dom = dom;
      this.state = {
        hoverId: null,
        selectedId: null,
        selectedTech: null,
        activeConnection: 0
      };
      this.layout = null;
      this.resizeTimer = 0;
      this.autoFrame = 0;
      this.flowStartedAt = 0;
      this.pulseFrame = 0;
      this.techLinkFrame = 0;
      this.nodeElements = new Map();
      this.connectionElements = new Map();
      this.pulseKey = null;
      this.techButtonById = new Map(
        Array.from(this.dom.techButtons, (button) => [button.dataset.tech, button])
      );
    }

    init() {
      this.bindEvents();
      this.renderLayout();
    }

    bindEvents() {
      this.dom.techButtons.forEach((button) => {
        button.addEventListener("click", () => this.selectTechnology(button.dataset.tech));
      });

      window.addEventListener("resize", () => {
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(() => this.renderLayout(), 80);
      });
      this.dom.viewport.addEventListener("scroll", () => this.scheduleTechnologyLinkDraw(), { passive: true });
      this.dom.techStrip.addEventListener("scroll", () => this.scheduleTechnologyLinkDraw(), { passive: true });

      this.dom.viewport.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          this.clearFocus();
        }
      });

      this.dom.frame.addEventListener("click", (event) => {
        if (event.target.closest(".node-card, .tech-chip")) {
          return;
        }
        this.clearFocus();
      });
    }

    renderLayout() {
      const width = Math.max(320, this.dom.viewport.clientWidth);
      const height = Math.max(360, this.dom.viewport.clientHeight);
      this.layout = this.makeLayout(width, height);
      const visualWidth = this.layout.width * this.layout.scale;
      const visualHeight = this.layout.height * this.layout.scale;

      this.dom.stage.style.width = `${visualWidth}px`;
      this.dom.stage.style.height = `${visualHeight}px`;
      this.dom.stage.style.fontSize = `${(16 * this.layout.fontBoost).toFixed(2)}px`;
      this.dom.svg.setAttribute("width", this.layout.width);
      this.dom.svg.setAttribute("height", this.layout.height);
      this.dom.svg.setAttribute("viewBox", `0 0 ${this.layout.width} ${this.layout.height}`);
      this.dom.labelSvg.setAttribute("width", this.layout.width);
      this.dom.labelSvg.setAttribute("height", this.layout.height);
      this.dom.labelSvg.setAttribute("viewBox", `0 0 ${this.layout.width} ${this.layout.height}`);
      this.fitLayersToViewport();

      this.drawGroups();
      this.drawNodes();
      this.drawConnections();
      this.renderInteractionState();
      this.startAutoTimeline();
    }

    startAutoTimeline() {
      if (reducedMotion) return;
      if (!this.flowStartedAt) {
        this.flowStartedAt = performance.now() - this.state.activeConnection * FLOW_STEP_MS;
      }
      window.cancelAnimationFrame(this.autoFrame);
      const tick = (now) => {
        const elapsed = Math.max(0, now - this.flowStartedAt);
        const nextConnection = Math.floor(elapsed / FLOW_STEP_MS) % connections.length;
        if (nextConnection !== this.state.activeConnection) {
          this.state.activeConnection = nextConnection;
          if (!this.hasManualFocus()) {
            this.renderInteractionState();
          }
        }
        this.autoFrame = window.requestAnimationFrame(tick);
      };
      this.autoFrame = window.requestAnimationFrame(tick);
    }

    makeLayout(viewportWidth, viewportHeight) {
      const isPhone = viewportWidth < 720;
      const isTablet = viewportWidth >= 720 && viewportWidth < 1180;
      const columnCount = isPhone ? 1 : isTablet ? 2 : 4;
      const rowCount = Math.ceil(groups.length / columnCount);
      const minStageWidth = isPhone ? viewportWidth : isTablet ? viewportWidth : 1880;
      const stageWidth = Math.max(viewportWidth, minStageWidth);
      const scale = isPhone || isTablet ? 1 : Math.min(1, viewportWidth / stageWidth);
      const fontBoost = isPhone || isTablet ? 1 : clamp(1 / Math.max(scale, 0.735), 1, 1.36);
      const layoutViewportHeight = isPhone || isTablet ? viewportHeight : viewportHeight / scale;
      const marginX = clamp(stageWidth * 0.04, isPhone ? 20 : isTablet ? 26 : 34, isPhone ? 42 : isTablet ? 48 : 92);
      const top = isPhone ? 46 : isTablet ? 38 : 24;
      const bottom = isPhone ? 26 : isTablet ? 34 : 44;
      const columnGap = isPhone ? 32 : isTablet ? clamp(stageWidth * 0.045, 36, 54) : clamp(stageWidth * 0.05, 86, 126);
      const rowGap = isPhone ? 34 : isTablet ? 38 : 0;
      const minPanelHeight = isPhone ? 520 : isTablet ? 610 : 360;
      const naturalPanelHeight = (layoutViewportHeight - top - bottom - rowGap * (rowCount - 1)) / rowCount;
      const panelHeight = isPhone || isTablet ? Math.max(minPanelHeight, naturalPanelHeight) : naturalPanelHeight;
      const stackedHeight = top + rowCount * panelHeight + rowGap * (rowCount - 1) + bottom;
      const stageHeight = isPhone || isTablet ? Math.max(viewportHeight, stackedHeight) : layoutViewportHeight;
      const panelWidth = (stageWidth - marginX * 2 - columnGap * (columnCount - 1)) / columnCount;

      const layout = this.emptyLayout(stageWidth, stageHeight, scale, fontBoost);

      groups.forEach((group, index) => {
        const row = Math.floor(index / columnCount);
        const col = index % columnCount;
        const panel = {
          x: marginX + col * (panelWidth + columnGap),
          y: top + row * (panelHeight + rowGap),
          w: panelWidth,
          h: panelHeight
        };
        layout.groups[group.id] = panel;

        const ids = group.componentIds;
        const inner = clamp(panelWidth * 0.06, isPhone ? 16 : 18, isTablet ? 24 : 28);
        const header = isPhone || isTablet ? 42 : 44;
        const nodeWidth = Math.min(isPhone ? 340 : isTablet ? 360 : 330, panelWidth - inner * 2);
        const usableHeight = panel.h - header - inner * 2;
        const metrics = distributeStack(usableHeight, ids.length, stackOptionsForGroup(group.id, isPhone, isTablet));
        const startY = panel.y + header + inner + Math.max(0, (usableHeight - metrics.clusterHeight) / 2);

        ids.forEach((id, nodeIndex) => {
          layout.nodes[id] = {
            x: panel.x + (panel.w - nodeWidth) / 2,
            y: startY + nodeIndex * (metrics.itemHeight + metrics.gap),
            w: nodeWidth,
            h: metrics.itemHeight
          };
        });
      });

      return layout;
    }

    emptyLayout(width, height, scale, fontBoost) {
      return {
        width,
        height,
        scale,
        fontBoost,
        groups: {},
        nodes: {}
      };
    }

    fitLayersToViewport() {
      const layerWidth = `${this.layout.width}px`;
      const layerHeight = `${this.layout.height}px`;
      const transform = `scale(${this.layout.scale})`;
      [this.dom.svg, this.dom.labelSvg, this.dom.groups, this.dom.nodes, this.dom.activeNodes].forEach((layer) => {
        layer.style.width = layerWidth;
        layer.style.height = layerHeight;
        layer.style.transform = transform;
        layer.style.transformOrigin = "0 0";
      });
    }

    drawGroups() {
      const fragment = document.createDocumentFragment();
      this.dom.groups.replaceChildren();
      groups.forEach((group) => {
        const rect = this.layout.groups[group.id];
        const panel = document.createElement("div");
        panel.className = "group-panel";
        panel.style.left = `${rect.x}px`;
        panel.style.top = `${rect.y}px`;
        panel.style.width = `${rect.w}px`;
        panel.style.height = `${rect.h}px`;
        panel.style.setProperty("--accent-rgb", group.color.rgb);

        const title = document.createElement("div");
        title.className = "group-title";
        title.textContent = group.title;
        panel.append(title);
        fragment.append(panel);
      });
      this.dom.groups.append(fragment);
    }

    drawNodes() {
      this.nodeElements.clear();
      const fragment = document.createDocumentFragment();
      this.dom.nodes.replaceChildren();
      this.dom.activeNodes.replaceChildren();

      components.forEach((component) => {
        const node = this.createNodeCard(component);
        this.nodeElements.set(component.id, node);
        fragment.append(node);
      });

      this.dom.nodes.append(fragment);
    }

    createNodeCard(component) {
      const node = document.createElement("article");
      node.className = "node-card";
      node.tabIndex = 0;
      node.dataset.id = component.id;
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", `${component.name}: ${component.description}`);
      this.applyRect(node, this.layout.nodes[component.id]);
      this.applyAccent(node, component.group);

      node.append(
        textElement("div", "node-kicker", component.name),
        textElement("div", "node-title", component.title),
        textElement("div", "node-note", component.note)
      );

      node.addEventListener("pointerenter", () => this.setHover(component.id));
      node.addEventListener("pointerleave", () => this.setHover(null));
      node.addEventListener("focus", () => this.setHover(component.id));
      node.addEventListener("blur", () => this.setHover(null));
      node.addEventListener("click", () => this.selectNode(component.id));
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.selectNode(component.id);
        }
      });

      return node;
    }

    drawConnections() {
      this.connectionElements.clear();
      this.pulseKey = null;
      const fragment = document.createDocumentFragment();
      this.dom.svg.replaceChildren();
      this.dom.labelSvg.replaceChildren();
      connections.forEach((connection, index) => {
        fragment.append(this.createConnectionGroup(connection, index));
      });
      this.dom.svg.append(fragment);
    }

    createConnectionGroup(connection, index) {
      const path = this.pathFor(connection);
      const d = pathToString(path);
      const kind = this.connectionKind(connection);
      const color = this.connectionColor(connection);
      const pulseMotions = [];
      const group = svgElement("g", {
        class: `connection connection-${kind}`,
        "data-id": connection.id,
        "data-index": index
      });

      group.append(svgElement("path", {
        class: "connection connection-shadow",
        d
      }));

      const line = svgElement("path", {
        class: "connection connection-line",
        d
      });
      group.append(line);

      if (!reducedMotion) {
        const forwardPulse = this.makePulse(d, color.hex, false);
        pulseMotions.push(forwardPulse.motion);
        group.append(forwardPulse.circle);
        if (connection.bidirectional) {
          const reversePulse = this.makePulse(pathToString(reversePath(path)), color.hex, true);
          pulseMotions.push(reversePulse.motion);
          group.append(reversePulse.circle);
        }
      }

      this.connectionElements.set(connection.id, { group, path, color: color.hex, connection, index, pulseMotions });
      return group;
    }

    makePulse(pathData, color, reverse) {
      const circle = svgElement("circle", {
        class: "pulse-dot",
        r: reverse ? "4.2" : "4.8",
        fill: color,
        style: `color: ${color}`
      });
      const motion = svgElement("animateMotion", {
        dur: `${FLOW_STEP_MS}ms`,
        begin: "indefinite",
        repeatCount: "1",
        path: pathData
      });
      circle.append(motion);
      return { circle, motion };
    }

    makeLabel(connection, path) {
      const label = truncate(connection.label, 34);
      const metrics = labelMetricsFor(label, this.layout.fontBoost);
      const { width, height, fontSize } = metrics;
      const point = this.labelPointFor(connection, path, width, height);
      const group = svgElement("g", {
        class: "edge-label-group"
      });
      group.append(svgElement("rect", {
        class: "edge-label-bg",
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        rx: height / 2,
        stroke: "rgba(72, 87, 105, 0.28)"
      }));
      const textNode = svgElement("text", {
        class: "edge-label",
        x: point.x,
        y: point.y,
        "font-size": fontSize,
        "text-anchor": "middle",
        "dominant-baseline": "middle"
      });
      textNode.textContent = label;
      group.append(textNode);
      return group;
    }

    labelPointFor(connection, path, width, height) {
      const fromRect = this.layout.nodes[connection.from];
      const toRect = this.layout.nodes[connection.to];
      const from = centerOf(fromRect);
      const to = centerOf(toRect);
      if (path.labelPoint) {
        const padding = Math.max(18, height * 0.72);
        return {
          x: clamp(path.labelPoint.x, width / 2 + padding, this.layout.width - width / 2 - padding),
          y: clamp(path.labelPoint.y, height / 2 + padding, this.layout.height - height / 2 - padding)
        };
      }
      const point = cubicPoint(path, 0.5);
      const padding = Math.max(18, height * 0.72);

      if (connection.kind === "feedback") {
        const yOffset = Math.max(10, height * 0.38);
        const y = connection.id === "ai-human" ? path.p1.y - yOffset : path.p1.y + yOffset;
        return {
          x: clamp(point.x, width / 2 + padding, this.layout.width - width / 2 - padding),
          y: clamp(y, height / 2 + padding, this.layout.height - height / 2 - padding)
        };
      }

      const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
      if (horizontal) {
        const channelLeft = Math.min(fromRect.x + fromRect.w, toRect.x + toRect.w);
        const channelRight = Math.max(fromRect.x, toRect.x);
        const x = channelRight > channelLeft
          ? (channelLeft + channelRight) / 2
          : point.x;
        const yOffset = (from.y <= to.y ? -1 : 1) * Math.max(28, height * 1.15);
        return {
          x: clamp(x, width / 2 + padding, this.layout.width - width / 2 - padding),
          y: clamp(point.y + yOffset, height / 2 + padding, this.layout.height - height / 2 - padding)
        };
      }

      const channelTop = Math.min(fromRect.y + fromRect.h, toRect.y + toRect.h);
      const channelBottom = Math.max(fromRect.y, toRect.y);
      const y = channelBottom > channelTop ? (channelTop + channelBottom) / 2 : point.y;
      return {
        x: clamp(point.x + Math.max(34, height * 1.3), width / 2 + padding, this.layout.width - width / 2 - padding),
        y: clamp(y, height / 2 + padding, this.layout.height - height / 2 - padding)
      };
    }

    pathFor(connection) {
      if (connection.kind === "feedback") {
        return this.feedbackPath(connection);
      }

      return this.flowPath(connection);
    }

    flowPath(connection) {
      const fromRect = this.layout.nodes[connection.from];
      const toRect = this.layout.nodes[connection.to];
      const fromCenter = centerOf(fromRect);
      const toCenter = centerOf(toRect);
      const sameColumn = Math.abs(fromCenter.x - toCenter.x) < Math.min(fromRect.w, toRect.w) * 0.55;
      const sameRow = Math.abs(fromCenter.y - toCenter.y) < Math.min(fromRect.h, toRect.h) * 0.65;

      if (sameColumn && !sameRow) {
        const fromSide = toCenter.y > fromCenter.y ? "bottom" : "top";
        const toSide = toCenter.y > fromCenter.y ? "top" : "bottom";
        const start = anchor(fromRect, fromSide);
        const end = anchor(toRect, toSide);
        return roundedPolylinePath([start, end], 38, {
          x: start.x + 38,
          y: (start.y + end.y) / 2
        });
      }

      const toRight = toCenter.x >= fromCenter.x;
      const start = anchor(fromRect, toRight ? "right" : "left");
      const end = anchor(toRect, toRight ? "left" : "right");
      const channelX = (start.x + end.x) / 2;
      return roundedPolylinePath([
        start,
        { x: channelX, y: start.y },
        { x: channelX, y: end.y },
        end
      ], 38, {
        x: channelX,
        y: (start.y + end.y) / 2
      });
    }

    feedbackPath(connection) {
      const fromRect = this.layout.nodes[connection.from];
      const toRect = this.layout.nodes[connection.to];
      if (connection.id === "ai-human") {
        const start = anchor(fromRect, "left");
        const end = anchor(toRect, "top");
        const safeTop = Math.min(
          this.layout.nodes.host.y,
          this.layout.nodes.reader.y,
          this.layout.nodes.mcp.y,
          end.y
        ) - 24;
        const channelY = Math.max(this.layout.groups.physical.y + 42, safeTop);
        const exitX = this.layout.groups.ai.x - 34;
        const points = [
          start,
          { x: exitX, y: start.y },
          { x: exitX, y: channelY },
          { x: end.x, y: channelY },
          end
        ];
        return roundedPolylinePath(points, 46, {
          x: (exitX + end.x) / 2,
          y: channelY - 8
        });
      }
      if (connection.id === "human-ai") {
        const start = anchor(fromRect, "right");
        const end = anchor(toRect, "bottom");
        const laneX = this.layout.groups.physical.x + this.layout.groups.physical.w + 34;
        const laneY = Math.min(
          this.layout.nodes.captureFile.y,
          this.layout.nodes.analysis.y,
          this.layout.nodes.output.y
        ) - 28;
        const points = [
          start,
          { x: laneX, y: start.y },
          { x: laneX, y: laneY },
          { x: end.x, y: laneY },
          end
        ];
        return roundedPolylinePath(points, 46, {
          x: (laneX + end.x) / 2,
          y: laneY + 8
        });
      }
      const start = anchor(fromRect, "bottom");
      const end = anchor(toRect, "left");
      const laneX = Math.max(24, this.layout.groups.physical.x - 28);
      const laneY = Math.min(this.layout.height - 46, Math.max(start.y, this.layout.nodes.captureFile.y + this.layout.nodes.captureFile.h) + 38);
      const points = [
        start,
        { x: start.x, y: laneY },
        { x: laneX, y: laneY },
        { x: laneX, y: end.y },
        end
      ];
      return roundedPolylinePath(points, 46, {
        x: (start.x + laneX) / 2,
        y: laneY - 8
      });
    }

    applyConnectionStates(focus) {
      const fragment = document.createDocumentFragment();
      this.dom.labelSvg.replaceChildren();

      this.connectionElements.forEach((entry) => {
        const related = this.isConnectionRelated(entry.connection, entry.index, focus);
        const hidden = entry.connection.kind === "feedback" && !related;
        entry.group.classList.toggle("is-related", related);
        entry.group.classList.toggle("is-muted", focus.manual && !related);
        entry.group.classList.toggle("is-hidden", hidden);

        if (!hidden) {
          fragment.append(this.makeEndpointArrow(entry.connection, entry.path, entry.color, "to", focus.manual && !related, related));
          if (entry.connection.bidirectional) {
            fragment.append(this.makeEndpointArrow(entry.connection, entry.path, entry.color, "from", focus.manual && !related, related));
          }
        }

        if (related) {
          fragment.append(this.makeLabel(entry.connection, entry.path));
        }
      });
      this.dom.labelSvg.append(fragment);
    }

    makeEndpointArrow(connection, path, color, end, muted, related) {
      const id = end === "to" ? connection.to : connection.from;
      const rect = this.layout.nodes[id];
      const point = end === "to" ? path.p3 : path.p0;
      const side = nearestSide(rect, point);
      const tip = insetPointOnRectSide(rect, side, point, 2);
      const tangent = end === "to"
        ? path.endTangent || { x: path.p3.x - (path.curveEnd || path.p2).x, y: path.p3.y - (path.curveEnd || path.p2).y }
        : path.startTangent
          ? { x: -path.startTangent.x, y: -path.startTangent.y }
          : { x: path.p0.x - (path.curveStart || path.p1).x, y: path.p0.y - (path.curveStart || path.p1).y };
      const arrow = arrowGeometryAtPoint(tip, tangent, {
        size: connection.bidirectional ? 10 : 11,
        width: connection.bidirectional ? 12 : 13.2
      });

      return svgElement("polygon", {
        class: `connection-end-arrow${muted ? " is-muted" : ""}${related ? " is-related" : ""}`,
        points: arrow.points,
        fill: color
      });
    }

    isConnectionRelated(connection, index, focus) {
      if (focus.manual) {
        return focus.focusedIds.length > 0 &&
          (focus.focusedIds.includes(connection.from) || focus.focusedIds.includes(connection.to));
      }

      return index === this.state.activeConnection;
    }

    hasManualFocus() {
      return Boolean(this.state.hoverId || this.state.selectedId || this.state.selectedTech);
    }

    connectionKind(connection) {
      return connection.kind || "main";
    }

    connectionColor(connection) {
      return connectionPalette[this.connectionKind(connection)] || palette.flow;
    }

    setHover(id) {
      if (this.state.hoverId === id) return;
      this.state.hoverId = id;
      this.renderInteractionState();
    }

    clearFocus() {
      if (!this.hasManualFocus()) return;
      this.state.hoverId = null;
      this.state.selectedId = null;
      this.state.selectedTech = null;
      this.renderInteractionState();
    }

    selectNode(id) {
      this.state.selectedTech = null;
      this.state.selectedId = this.state.selectedId === id ? null : id;
      this.renderInteractionState();
    }

    selectTechnology(id) {
      this.state.hoverId = null;
      this.state.selectedId = null;
      this.state.selectedTech = this.state.selectedTech === id ? null : id;
      this.renderInteractionState();
    }

    renderInteractionState() {
      const focus = this.computeFocusState();
      this.applyNodeStates(focus);
      this.applyTechnologyStates();
      this.applyConnectionStates(focus);
      this.restartPulsesWhenFocusChanges(focus);
      this.drawTechnologyLinks();
      this.updateStatus();
    }

    computeFocusState() {
      const active = connections[this.state.activeConnection];
      const focusedIds = [this.state.hoverId, this.state.selectedId].filter(Boolean);
      const techTargetIds = this.state.selectedTech ? technologyTargets[this.state.selectedTech].targets : [];
      const hasFocus = focusedIds.length > 0 || techTargetIds.length > 0;
      const relatedIds = new Set();

      if (focusedIds.length > 0) {
        focusedIds.forEach((id) => relatedIds.add(id));
        connections.forEach((connection) => {
          const touchesFocus = focusedIds.includes(connection.from) || focusedIds.includes(connection.to);
          if (touchesFocus) {
            relatedIds.add(connection.from);
            relatedIds.add(connection.to);
          }
        });
      }
      techTargetIds.forEach((id) => relatedIds.add(id));

      if (!hasFocus && active) {
        relatedIds.add(active.from);
      }

      return {
        autoActiveId: hasFocus ? null : active?.from,
        focusedIds,
        hasFocus,
        manual: this.hasManualFocus(),
        relatedIds,
        techTargetIds
      };
    }

    applyNodeStates(focus) {
      this.dom.frame.classList.toggle("has-focused-node", focus.hasFocus);
      this.dom.frame.classList.toggle("has-tech-focus", Boolean(this.state.selectedTech));
      this.nodeElements.forEach((node, id) => {
        const activeNode =
          id === this.state.hoverId ||
          id === this.state.selectedId ||
          id === focus.autoActiveId ||
          focus.techTargetIds.includes(id);
        const related = focus.relatedIds.has(id);
        node.classList.toggle("is-related", related);
        node.classList.toggle("is-active", activeNode);
        node.classList.toggle("is-selected", id === this.state.selectedId);
        node.classList.toggle("is-dimmed", focus.hasFocus && !related);
        const targetLayer = activeNode ? this.dom.activeNodes : this.dom.nodes;
        if (node.parentElement !== targetLayer) {
          targetLayer.append(node);
        }
      });
    }

    restartPulsesWhenFocusChanges(focus) {
      if (reducedMotion) return;

      const pulseKey = focus.manual
        ? `manual:${focus.focusedIds.join("|")}:${this.state.selectedTech || ""}`
        : `auto:${this.state.activeConnection}`;
      if (pulseKey === this.pulseKey) return;
      this.pulseKey = pulseKey;

      window.cancelAnimationFrame(this.pulseFrame);
      const motionsToStart = [];

      this.connectionElements.forEach((entry) => {
        const related = this.isConnectionRelated(entry.connection, entry.index, focus);
        entry.pulseMotions.forEach((motion) => {
          try {
            motion.setAttribute("repeatCount", "1");
            if (focus.manual && typeof motion.endElement === "function") {
              motion.endElement();
            } else if (related) {
              motionsToStart.push(motion);
            } else if (typeof motion.endElement === "function") {
              motion.endElement();
            }
          } catch {
            // Some browsers ignore SMIL control calls before the animation is ready.
          }
        });
      });

      this.pulseFrame = window.requestAnimationFrame(() => {
        motionsToStart.forEach((motion) => {
          try {
            motion.beginElement();
          } catch {
            // Some browsers ignore SMIL control calls before the animation is ready.
          }
        });
      });
    }

    updateStatus() {
      if (this.state.selectedTech) {
        const tech = technologyTargets[this.state.selectedTech];
        const targetNames = tech.targets.map((id) => componentById[id].name).join(", ");
        this.dom.status.textContent = `${tech.label} is used by: ${targetNames}.`;
        return;
      }
      const selected = this.state.selectedId
        ? `${componentById[this.state.selectedId].name}: ${componentById[this.state.selectedId].description} `
        : "";
      this.dom.status.textContent = selected + connections[this.state.activeConnection].text;
    }

    applyTechnologyStates() {
      this.dom.techStrip.classList.toggle("has-selected-tech", Boolean(this.state.selectedTech));
      this.dom.techButtons.forEach((button) => {
        const selected = button.dataset.tech === this.state.selectedTech;
        button.classList.toggle("is-selected", selected);
        button.classList.toggle("is-dimmed", Boolean(this.state.selectedTech) && !selected);
      });
    }

    drawTechnologyLinks() {
      if (!this.state.selectedTech) {
        if (this.dom.frameTechLinks.childNodes.length > 0) {
          this.dom.frameTechLinks.replaceChildren();
        }
        return;
      }

      this.dom.frameTechLinks.replaceChildren();
      const tech = technologyTargets[this.state.selectedTech];
      const button = this.techButtonById.get(this.state.selectedTech);
      if (!button || !tech) return;

      const frameRect = this.dom.frame.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const width = Math.max(1, Math.round(frameRect.width));
      const height = Math.max(1, Math.round(frameRect.height));
      const source = {
        x: buttonRect.left + buttonRect.width / 2 - frameRect.left,
        y: buttonRect.top - frameRect.top
      };
      const fragment = document.createDocumentFragment();
      const maskId = "tech-link-active-card-mask";
      const defs = svgElement("defs", {});
      const mask = svgElement("mask", {
        id: maskId,
        maskUnits: "userSpaceOnUse"
      });
      mask.append(svgElement("rect", {
        x: 0,
        y: 0,
        width,
        height,
        fill: "#ffffff"
      }));
      this.nodeElements.forEach((node) => {
        if (!node.classList.contains("is-active")) return;
        const rect = frameRectFromElement(node, frameRect);
        mask.append(svgElement("rect", {
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          rx: 8,
          fill: "#000000"
        }));
      });
      defs.append(mask);
      fragment.append(defs);

      const linkGroup = svgElement("g", {
        mask: `url(#${maskId})`
      });
      const arrowGroup = svgElement("g", {});

      tech.targets.forEach((targetId) => {
        const node = this.nodeElements.get(targetId);
        if (!node) return;
        const targetRect = frameRectFromElement(node, frameRect);
        const end = closestPointOnRectFromPoint(targetRect, source);
        const tip = insetPointOnRectSide(targetRect, end.side, end, -6);
        const arrow = arrowGeometryAtPoint(tip, vectorBetween(source, tip), {
          size: 12,
          width: 14.4
        });
        linkGroup.append(svgElement("line", {
          class: "tech-link",
          x1: source.x,
          y1: source.y,
          x2: arrow.base.x,
          y2: arrow.base.y
        }));
        arrowGroup.append(svgElement("polygon", {
          class: "tech-link-target",
          points: arrow.points
        }));
      });

      fragment.append(linkGroup);
      fragment.append(arrowGroup);
      this.dom.frameTechLinks.setAttribute("width", width);
      this.dom.frameTechLinks.setAttribute("height", height);
      this.dom.frameTechLinks.setAttribute("viewBox", `0 0 ${width} ${height}`);
      this.dom.frameTechLinks.append(fragment);
    }

    scheduleTechnologyLinkDraw() {
      if (!this.state.selectedTech) return;
      window.cancelAnimationFrame(this.techLinkFrame);
      this.techLinkFrame = window.requestAnimationFrame(() => this.drawTechnologyLinks());
    }

    applyRect(element, rect) {
      element.style.left = `${rect.x}px`;
      element.style.top = `${rect.y}px`;
      element.style.width = `${rect.w}px`;
      element.style.height = `${rect.h}px`;
    }

    applyAccent(element, groupId) {
      const group = groupById[groupId] || { color: palette.output };
      element.style.setProperty("--accent-rgb", group.color.rgb);
    }
  }

  function svgElement(name, attrs) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  function textElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function stackOptionsForGroup(groupId, isPhone, isTablet) {
    if (groupId === "pipeline" && !isPhone) {
      return {
        minItem: isTablet ? 112 : 118,
        maxItem: isTablet ? 140 : 138,
        preferredGap: isTablet ? 42 : 68,
        minGap: isTablet ? 30 : 56,
        maxGap: isTablet ? 96 : 190
      };
    }

    return {
      minItem: isPhone ? 112 : isTablet ? 120 : 82,
      maxItem: isPhone ? 142 : isTablet ? 154 : 162,
      preferredGap: isPhone ? 22 : isTablet ? 28 : 38,
      minGap: isPhone ? 16 : isTablet ? 18 : 16,
      maxGap: isPhone ? 60 : isTablet ? 72 : 172
    };
  }

  function distributeStack(usableHeight, count, options) {
    if (count <= 0) {
      return { itemHeight: 0, gap: 0, clusterHeight: 0 };
    }

    const preferredGap = count > 1 ? options.preferredGap : 0;
    const minGap = count > 1 ? options.minGap : 0;
    const maxGap = count > 1 ? options.maxGap : 0;
    let itemHeight = clamp((usableHeight - preferredGap * (count - 1)) / count, options.minItem, options.maxItem);
    let gap = count > 1 ? (usableHeight - itemHeight * count) / (count - 1) : 0;

    if (count > 1 && gap < minGap) {
      itemHeight = Math.max(42, (usableHeight - minGap * (count - 1)) / count);
      gap = minGap;
    } else if (count > 1) {
      gap = clamp(gap, preferredGap, maxGap);
    }

    return {
      itemHeight,
      gap,
      clusterHeight: itemHeight * count + gap * Math.max(0, count - 1)
    };
  }

  function anchor(rect, side) {
    if (side === "top") return { x: rect.x + rect.w / 2, y: rect.y };
    if (side === "bottom") return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    if (side === "left") return { x: rect.x, y: rect.y + rect.h / 2 };
    return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  }

  function centerOf(rect) {
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }

  function frameRectFromElement(element, frameRect) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - frameRect.left,
      y: rect.top - frameRect.top,
      w: rect.width,
      h: rect.height
    };
  }

  function nearestSide(rect, point) {
    const distances = [
      { side: "left", value: Math.abs(point.x - rect.x) },
      { side: "right", value: Math.abs(point.x - (rect.x + rect.w)) },
      { side: "top", value: Math.abs(point.y - rect.y) },
      { side: "bottom", value: Math.abs(point.y - (rect.y + rect.h)) }
    ];
    distances.sort((a, b) => a.value - b.value);
    return distances[0].side;
  }

  function closestPointOnRectFromPoint(targetRect, sourcePoint) {
    const sourceX = sourcePoint.x;
    const sourceY = sourcePoint.y;
    const targetX = targetRect.x + targetRect.w / 2;
    const targetY = targetRect.y + targetRect.h / 2;
    const dx = sourceX - targetX;
    const dy = sourceY - targetY;
    let x;
    let y;
    let side;

    if (Math.abs(dx) > Math.abs(dy)) {
      side = dx < 0 ? "left" : "right";
      x = side === "left" ? targetRect.x : targetRect.x + targetRect.w;
      y = clamp(sourceY, targetRect.y + 8, targetRect.y + targetRect.h - 8);
    } else {
      side = dy < 0 ? "top" : "bottom";
      x = clamp(sourceX, targetRect.x + 8, targetRect.x + targetRect.w - 8);
      y = side === "top" ? targetRect.y : targetRect.y + targetRect.h;
    }

    return { x, y, side };
  }

  function insetPointOnRectSide(rect, side, edgePoint, inset) {
    const x = clamp(edgePoint.x, rect.x + 8, rect.x + rect.w - 8);
    const y = clamp(edgePoint.y, rect.y + 8, rect.y + rect.h - 8);

    if (side === "left") return { x: rect.x + inset, y };
    if (side === "right") return { x: rect.x + rect.w - inset, y };
    if (side === "top") return { x, y: rect.y + inset };
    return { x, y: rect.y + rect.h - inset };
  }

  function arrowGeometryAtPoint(tip, direction, options = {}) {
    const size = options.size || 9;
    const width = options.width || size * 1.16;
    const unit = normalizeVector(direction);
    const base = {
      x: tip.x - unit.x * size,
      y: tip.y - unit.y * size
    };
    const perpendicular = { x: -unit.y, y: unit.x };
    const halfWidth = width / 2;

    return {
      base,
      points: pointsToString([
        tip,
        {
          x: base.x + perpendicular.x * halfWidth,
          y: base.y + perpendicular.y * halfWidth
        },
        {
          x: base.x - perpendicular.x * halfWidth,
          y: base.y - perpendicular.y * halfWidth
        }
      ])
    };
  }

  function vectorBetween(from, to) {
    return {
      x: to.x - from.x,
      y: to.y - from.y
    };
  }

  function normalizeVector(vector) {
    const length = Math.hypot(vector.x, vector.y);
    if (length < 0.001) return { x: 1, y: 0 };
    return { x: vector.x / length, y: vector.y / length };
  }

  function pointsToString(points) {
    return points.map((point) => `${point.x},${point.y}`).join(" ");
  }

  function labelMetricsFor(text, fontBoost) {
    const fontSize = Math.round(12 * fontBoost * 10) / 10;
    const horizontalPadding = Math.max(13, fontSize * 1.08);
    const verticalPadding = Math.max(6, fontSize * 0.52);
    const minWidth = Math.max(86, fontSize * 6.2);
    const maxWidth = Math.max(236, 236 * fontBoost);
    const textWidth = measureLabelText(text, fontSize);
    const rawWidth = clamp(textWidth + horizontalPadding * 2, minWidth, maxWidth);
    const widthBuckets = [116, 144, 176, 208, 244, 284, 324];
    const bucketWidth = widthBuckets.find((width) => width >= rawWidth) || maxWidth;

    return {
      fontSize,
      width: Math.ceil(Math.min(bucketWidth, maxWidth)),
      height: Math.ceil(fontSize + verticalPadding * 2)
    };
  }

  function measureLabelText(text, fontSize) {
    if (!measureLabelText.canvas) {
      measureLabelText.canvas = document.createElement("canvas");
    }
    const context = measureLabelText.canvas.getContext("2d");
    context.font = `760 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    return context.measureText(text).width;
  }

  function curvePath(start, end, direction) {
    if (direction === "vertical") {
      const sign = end.y >= start.y ? 1 : -1;
      const terminal = terminalLength(Math.abs(end.y - start.y), { min: 34, max: 58, ratio: 0.18 });
      const curveStart = { x: start.x, y: start.y + sign * terminal };
      const curveEnd = { x: end.x, y: end.y - sign * terminal };
      const bend = clamp(Math.abs(curveEnd.y - curveStart.y) * 0.45, 44, 136);
      return {
        p0: start,
        curveStart,
        p1: { x: curveStart.x, y: curveStart.y + sign * bend },
        p2: { x: curveEnd.x, y: curveEnd.y - sign * bend },
        curveEnd,
        p3: end
      };
    }

    const sign = end.x >= start.x ? 1 : -1;
    const terminal = terminalLength(Math.abs(end.x - start.x), { min: 34, max: 58, ratio: 0.18 });
    const curveStart = { x: start.x + sign * terminal, y: start.y };
    const curveEnd = { x: end.x - sign * terminal, y: end.y };
    const bend = clamp(Math.abs(curveEnd.x - curveStart.x) * 0.45, 48, 166);
    return {
      p0: start,
      curveStart,
      p1: { x: curveStart.x + sign * bend, y: curveStart.y },
      p2: { x: curveEnd.x - sign * bend, y: curveEnd.y },
      curveEnd,
      p3: end
    };
  }

  function routedChannelPath(start, end, channelY, terminalOptions) {
    const startSign = channelY >= start.y ? 1 : -1;
    const endSign = channelY >= end.y ? 1 : -1;
    const startTerminal = terminalLength(Math.abs(channelY - start.y), terminalOptions);
    const endTerminal = terminalLength(Math.abs(channelY - end.y), terminalOptions);
    const curveStart = { x: start.x, y: start.y + startSign * startTerminal };
    const curveEnd = { x: end.x, y: end.y + endSign * endTerminal };

    return {
      p0: start,
      curveStart,
      p1: { x: curveStart.x, y: channelY },
      p2: { x: curveEnd.x, y: channelY },
      curveEnd,
      p3: end
    };
  }

  function roundedPolylinePath(points, radius, labelPoint) {
    const routePoints = simplifyRoutePoints(points);
    const commands = [`M ${routePoints[0].x} ${routePoints[0].y}`];

    for (let index = 1; index < routePoints.length - 1; index += 1) {
      const previous = routePoints[index - 1];
      const current = routePoints[index];
      const next = routePoints[index + 1];
      const incoming = normalizeVector({
        x: previous.x - current.x,
        y: previous.y - current.y
      });
      const outgoing = normalizeVector({
        x: next.x - current.x,
        y: next.y - current.y
      });
      const cornerRadius = Math.min(
        radius,
        distanceBetween(previous, current) / 2,
        distanceBetween(current, next) / 2
      );

      if (cornerRadius <= 0.5) {
        commands.push(`L ${current.x} ${current.y}`);
        continue;
      }

      const before = {
        x: current.x + incoming.x * cornerRadius,
        y: current.y + incoming.y * cornerRadius
      };
      const after = {
        x: current.x + outgoing.x * cornerRadius,
        y: current.y + outgoing.y * cornerRadius
      };
      commands.push(`L ${before.x} ${before.y}`);
      commands.push(`Q ${current.x} ${current.y} ${after.x} ${after.y}`);
    }

    const last = routePoints[routePoints.length - 1];
    commands.push(`L ${last.x} ${last.y}`);

    return {
      d: commands.join(" "),
      points: routePoints,
      radius,
      p0: routePoints[0],
      p3: last,
      startTangent: {
        x: routePoints[1].x - routePoints[0].x,
        y: routePoints[1].y - routePoints[0].y
      },
      endTangent: {
        x: last.x - routePoints[routePoints.length - 2].x,
        y: last.y - routePoints[routePoints.length - 2].y
      },
      labelPoint
    };
  }

  function simplifyRoutePoints(points) {
    const withoutDuplicates = points.filter((point, index) => {
      if (index === 0) return true;
      return distanceBetween(point, points[index - 1]) > 0.5;
    });

    if (withoutDuplicates.length <= 2) return withoutDuplicates;

    const simplified = [withoutDuplicates[0]];
    for (let index = 1; index < withoutDuplicates.length - 1; index += 1) {
      const previous = simplified[simplified.length - 1];
      const current = withoutDuplicates[index];
      const next = withoutDuplicates[index + 1];
      if (!isCollinear(previous, current, next)) {
        simplified.push(current);
      }
    }
    simplified.push(withoutDuplicates[withoutDuplicates.length - 1]);
    return simplified;
  }

  function isCollinear(a, b, c) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    return Math.abs(ab.x * bc.y - ab.y * bc.x) < 0.5 &&
      ab.x * bc.x + ab.y * bc.y >= 0;
  }

  function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function terminalLength(distance, options = {}) {
    const min = options.min ?? 20;
    const max = options.max ?? 34;
    const ratio = options.ratio ?? 0.12;
    return Math.min(distance / 2.4, clamp(distance * ratio, min, max));
  }

  function pathToString(path) {
    if (path.d) return path.d;
    const curveStart = path.curveStart || path.p0;
    const curveEnd = path.curveEnd || path.p3;
    const lead = path.curveStart ? ` L ${curveStart.x} ${curveStart.y}` : "";
    const tail = path.curveEnd ? ` L ${path.p3.x} ${path.p3.y}` : "";
    return `M ${path.p0.x} ${path.p0.y}${lead} C ${path.p1.x} ${path.p1.y}, ${path.p2.x} ${path.p2.y}, ${curveEnd.x} ${curveEnd.y}${tail}`;
  }

  function reversePath(path) {
    if (path.points) {
      return roundedPolylinePath([...path.points].reverse(), path.radius || 38, path.labelPoint);
    }

    return {
      p0: path.p3,
      curveStart: path.curveEnd,
      p1: path.p2,
      p2: path.p1,
      curveEnd: path.curveStart,
      p3: path.p0
    };
  }

  function cubicPoint(path, t) {
    const mt = 1 - t;
    const p0 = path.curveStart || path.p0;
    const p3 = path.curveEnd || path.p3;
    return {
      x: mt ** 3 * p0.x + 3 * mt ** 2 * t * path.p1.x + 3 * mt * t ** 2 * path.p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt ** 2 * t * path.p1.y + 3 * mt * t ** 2 * path.p2.y + t ** 3 * p3.y
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}...`;
  }

  new ArchitectureDiagram(elements).init();
}());
