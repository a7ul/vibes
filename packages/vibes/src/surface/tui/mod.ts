import React from "react";
import { render } from "ink";
import { App } from "./app.tsx";
import type { TuiConfig } from "./types.ts";

export { type TuiConfig } from "./types.ts";

export function renderTui(config: TuiConfig): void {
  render(React.createElement(App, { config }));
}
