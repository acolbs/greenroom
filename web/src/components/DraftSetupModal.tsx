import React, { useState } from "react";
import "./draftPhase.css";

type Props = {
  onStart: (commaSeparatedPickNumbers: string) => void;
  error: string | null;
};

export default function DraftSetupModal({ onStart, error }: Props) {
  const [value, setValue] = useState("14, 45, 78");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(value);
  };

  return (
    <div className="draft-setup-overlay" role="presentation">
      <div
        className="draft-setup-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-setup-title"
      >
        <h2 id="draft-setup-title" className="draft-setup-title">
          Draft setup
        </h2>
        <p className="muted draft-setup-desc">
          Enter the pick numbers you own for this draft (comma separated). The league will auto-pick best available by overall rank between your turns. Up to 90 picks (3 rounds) or your board size,
          whichever is smaller.
        </p>
        <form onSubmit={submit}>
          <label className="draft-setup-label" htmlFor="draft-picks-input">
            Your pick numbers
          </label>
          <input
            id="draft-picks-input"
            className="draft-setup-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 14, 45, 78"
            autoComplete="off"
          />
          {error ? (
            <p className="draft-setup-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary draft-setup-submit">
            Start live draft
          </button>
        </form>
      </div>
    </div>
  );
}
