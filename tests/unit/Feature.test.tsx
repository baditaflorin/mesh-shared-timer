import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders a labelled shared-timer setup with one clear start action", () => {
    const room = createMockRoom();
    render(<Feature room={room} config={config} />);
    expect(screen.getByRole("heading", { level: 1, name: "Shared Timer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start 5 min" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Choose duration" })).toBeInTheDocument();
  });

  it("shows a connecting state when room is null", () => {
    render(<Feature room={null} config={config} />);
    expect(screen.getByRole("heading", { level: 1, name: "Shared Timer" })).toBeInTheDocument();
    expect(screen.getByText("Connecting to room")).toBeInTheDocument();
  });
});
