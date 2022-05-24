import "./App.css";
import { CellInput, Extension } from "./Input";
import styled from "styled-components";
import { html } from "htm/react";
import React from "react";
import immer from "immer";
import { v4 as uuidv4 } from "uuid";

import { indentLess, indentMore } from "@codemirror/commands";
import { Facet, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { groupBy } from "lodash";

import "./editor.css";
import "./dark_color.css";
import "./App.css";

let Cell = styled.div`
  &.modified {
    outline: solid 4px #f0f0f0;
  }
`;

let Partytime = () => {
  React.useEffect(() => {
    window.parent.postMessage(
      {
        type: "ready",
      },
      "*"
    );
  }, []);
  return null;
};

let AddCellButtonStyle = styled.button`
  all: unset;

  padding-bottom: 3px;
  padding-left: 12px;
  padding-right: 12px;
  margin: 3px;

  cursor: pointer;
  border-radius: 8px;
  background-color: transparent;
  transition: background-color 0.2s;

  & .hidden-till-hover {
    font-size: 0.9rem;
    opacity: 0;
    transition: opacity 0.2s;
  }
  &:hover .hidden-till-hover {
    opacity: 1;
  }

  &:hover {
    background-color: #ffffff1f;
  }
`;
let AddCellButton = ({ onClick }) => {
  return html` <${AddCellButtonStyle} onClick=${onClick}>+ <span className="hidden-till-hover">add cell</span></${AddCellButtonStyle}> `;
};

/** @type {Facet<string, string>} */
let CellIdFacet = Facet.define({
  combine: (x) => x[0],
});

let empty_cell = () => {
  return {
    id: uuidv4(),
    code: "",
  };
};

function useEvent(handler) {
  const handlerRef = React.useRef(null);

  // In a real implementation, this would run before layout effects
  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return React.useCallback((...args) => {
    // In a real implementation, this would throw if called during render
    const fn = handlerRef.current;
    return fn(...args);
  }, []);
}

let NotebookHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 16px 16px;
  position: sticky;
  top: 0;
  z-index: 1000000;
  background-color: var(--main-bg-color);
`;

/**
 * @typedef Cell
 * @type {{
 *  id: string,
 *  code: string,
 * }}
 */

function App() {
  let [currently_saved_cells, set_currently_saved_cells] = React.useState(
    /** @type {Array<Cell>} */ (null)
  );
  let [cells, set_cells] = React.useState(/** @type {Array<Cell>} */ (null));

  React.useEffect(() => {
    window.parent.postMessage({ type: "load" }, "*");
    window.addEventListener("message", (message) => {
      if (message.source !== window.parent) return;
      if (message.data?.type === "load") {
        let cells_we_got_back = message.data.cells ?? [];
        let cells =
          cells_we_got_back.length === 0 ? [empty_cell()] : cells_we_got_back;

        set_currently_saved_cells(cells);
        set_cells(cells);
      }
    });
  }, []);

  console.log(`cells:`, cells);

  let cell_keymap = Prec.high(
    keymap.of([
      {
        key: "Shift-Enter",
        run: () => {
          // on_submit();
          console.log("Submit");
          return true;
        },
      },
      {
        key: "Ctrl-Enter",
        mac: "Cmd-Enter",
        run: () => {
          // Add a new cell below
          // on_submit();
          console.log("Submit and add cell below");
          return true;
        },
      },
      {
        key: "Tab",
        run: indentMore,
        shift: indentLess,
      },
      {
        key: "Ctrl-s",
        mac: "Cmd-s",
        run: () => {
          console.log(`currently_saved_cells:`, currently_saved_cells);
          set_currently_saved_cells(cells);
          window.parent.postMessage({ type: "save", cells }, "*");
          return true;
        },
      },
    ])
  );

  if (cells == null) {
    return null;
  }

  return html`
    <${NotebookHeader}>
      <h1>Paintbrush</h1>

      <button
        onClick=${() => {
          window.parent.postMessage(
            { type: "toggle-horizontal-position" },
            "*"
          );
        }}
      >
        s
      </button>
    </${NotebookHeader}>

    <${Partytime} />

    ${cells.map(
      ({ code, id }, cell_index) => html`
        <${React.Fragment} key=${id}>
          <${Cell}
            className=${
              code !==
              (currently_saved_cells.find((x) => x.id === id)?.code ?? "")
                ? "modified"
                : ""
            }
          >
            <${CellInput} code=${code}>
              <${Extension} extension=${cell_keymap} />
              <${Extension} extension=${CellIdFacet.of(id)} />
              <${Extension}
                extension=${EditorView.updateListener.of((update) => {
                  if (update.docChanged) {
                    let new_code = update.state.doc.toString();
                    let new_cells = immer(cells, (cells) => {
                      for (let cell of cells) {
                        if (cell.id === id) {
                          cell.code = new_code;
                        }
                      }
                    });

                    window.parent.postMessage(
                      {
                        type: "css",
                        code: new_cells.map((x) => x.code).join("\n\n"),
                      },
                      "*"
                    );
                    set_cells(new_cells);
                  }
                })}
              />
            </${CellInput}>
          </${Cell}>
          <${AddCellButton}
            onClick=${() => {
              set_cells([
                ...cells.slice(0, cell_index + 1),
                empty_cell(),
                ...cells.slice(cell_index + 1),
              ]);
            }}
          />
        </${React.Fragment}>
      `
    )}
  `;
}

export default App;
