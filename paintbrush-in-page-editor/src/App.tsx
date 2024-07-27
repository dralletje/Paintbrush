import "./App.css";
import { CodeMirror, Extension, useEditorView } from "./Codemirror";
import styled from "styled-components";
import { html } from "htm/react";
import React from "react";
import immer from "immer";

import { indentLess, indentMore } from "@codemirror/commands";
import { Facet, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { groupBy, isEqual } from "lodash-es";

import "./dark_color.css";
import "./App.css";
import { debug_syntax_plugin } from "./Codemirror/debug_syntax_plugin";
import { dot_gutter } from "./Codemirror/dot-gutter";
import {
  ActiveSelector,
  pkgBubblePlugin,
} from "./Codemirror/CssSelectorHighlight";
import { EyeIcon, EyeOffIcon, XCircleIcon } from "lucide-react";

let Cell = styled.div`
  /* border-radius: 20px 20px 0 0; */

  border-bottom: solid 1px #242424;

  &.modified {
    /* outline: solid 4px #f0f0f0; */
    /* background-color: #432b00; */
    background-color: #052f1e;
    --main-bg-color: #052f1e;
  }

  &.disabled {
    opacity: 0.5;
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

let AddCellButton = ({ onClick }) => {
  return (
    <div className="flex flex-row justify-center py-2 sticky bottom-0 bg-[--main-bg-color]">
      <button
        className="px-4 py-[2px] text-white/60 bg-white/0 hover:bg-white/10 transition-colors text-xs rounded-full"
        onClick={onClick}
      >
        add style
      </button>
    </div>
  );
};

let CellIdFacet: Facet<string, string> = Facet.define({
  combine: (x) => x[0],
});

let empty_cell = () => {
  return {
    id: crypto.randomUUID(),
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

/**
 * @param {{
 *  value: string,
 *  onChange?: (code: string) => void,
 *  children: React.ReactNode,
 * }} props
 */
export const CellInput = ({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange?: (code: string) => void;
  children: React.ReactNode;
}) => {
  let editor_state = useEditorView({
    code: value,
  });

  let on_change_extension = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange?.(update.state.doc.toString());
      }
    });
  }, []);

  return (
    <CodeMirror as="pluto-input" editor_state={editor_state}>
      <Extension extension={on_change_extension} />

      {children}
    </CodeMirror>
  );
};

let NotebookHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 4px 6px;
  color: rgb(161, 111, 255);
  background-color: rgb(45, 16, 93);
  border-radius: 10px 10px 0px 0px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  position: sticky;
  top: 0px;

  h1 {
    font-size: 12px;
    font-weight: bold;
  }
`;

type Cell = {
  id: string;
  code: string;
  disabled?: boolean;
  collapsed?: boolean;
  name?: string;
};

let classes = (obj) => {
  return Object.entries(obj)
    .filter(([key, value]) => value)
    .map(([key, value]) => key)
    .join(" ");
};

function Editor() {
  let [currently_saved_cells, set_currently_saved_cells] =
    React.useState<Array<Cell> | null>(null);
  let [cells, set_cells] = React.useState<Array<Cell> | null>(null);

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

  let cell_keymap = React.useMemo(() => {
    return Prec.high(
      keymap.of([
        {
          key: "Backspace",
          run: (view) => {
            // If cell is empty, remove it
            if (view.state.doc.toString() === "") {
              let current_cell_id = view.state.facet(CellIdFacet);
              let new_cells = cells.filter(
                (cell) => cell.id !== current_cell_id
              );
              set_cells(new_cells);
              return true;
            }
            return false;
          },
        },
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
            console.log("AAA");
            set_currently_saved_cells(cells);
            window.parent.postMessage({ type: "save", cells }, "*");
            return true;
          },
        },
      ])
    );
  }, [set_currently_saved_cells, cells]);

  console.log("cells:", cells);
  if (cells == null) {
    return null;
  }

  let send_cells = (cells: Array<Cell>) => {
    window.parent.postMessage(
      {
        type: "css",
        code: cells
          .filter((x) => !x.disabled)
          .map((x) => x.code)
          .join("\n\n"),
      },
      "*"
    );
  };

  return (
    <div
      className="overscroll-contain"
      onKeyDown={(event) => {
        if (event.key === "s" && event.metaKey) {
          event.preventDefault();
          set_currently_saved_cells(cells);
          window.parent.postMessage({ type: "save", cells }, "*");
        }
      }}
    >
      <NotebookHeader className="z-50">
        <div>
          <button
            className="block"
            onClick={() => {
              window.parent.postMessage({ type: "close" }, "*");
            }}
          >
            <XCircleIcon size={12} />
          </button>
        </div>

        <h1
          style={{ lineHeight: "normal" }}
          className="flex-1 flex flex-row justify-center"
        >
          Paintbrush
        </h1>

        <div>
          {cells.every((x) => x.collapsed) ? (
            <button
              className="block"
              onClick={() => {
                let new_cells = cells.map((x) => {
                  return {
                    ...x,
                    collapsed: false,
                  };
                });
                set_cells(new_cells);
                set_currently_saved_cells(new_cells);
                window.parent.postMessage({ type: "save", cells }, "*");
              }}
            >
              <EyeIcon size={12} />
            </button>
          ) : (
            <button
              className="block"
              onClick={() => {
                let new_cells = cells.map((x) => {
                  return {
                    ...x,
                    collapsed: true,
                  };
                });
                set_cells(new_cells);
                set_currently_saved_cells(new_cells);
                window.parent.postMessage({ type: "save", cells }, "*");
              }}
            >
              <EyeOffIcon size={12} />
            </button>
          )}
        </div>
      </NotebookHeader>

      <Partytime />

      {cells.map((cell, cell_index) => {
        let { code, id, name = "", disabled = false, collapsed = false } = cell;
        let currently_saved_version = currently_saved_cells.find(
          (x) => x.id === id
        );
        return (
          <React.Fragment key={id}>
            <Cell
              className={classes({
                modified: !isEqual(cell, currently_saved_version),
                disabled: disabled,
              })}
            >
              <div
                className="flex flex-row items-center sticky top-[23px] z-10 pt-1"
                style={{ backgroundColor: `var(--main-bg-color)` }}
              >
                <input
                  type="text"
                  className="text-lg flex-1 px-2 py-1 outline-none bg-transparent text-white font-semibold placeholder:text-white/20"
                  placeholder="my browser, my style"
                  value={name}
                  onChange={({ target: { value } }) => {
                    set_cells(
                      cells.map((x, i) =>
                        i === cell_index ? { ...x, name: value } : x
                      )
                    );
                  }}
                />

                <div className="flex flex-row gap-1 pr-2 items-center">
                  <button
                    className="transition-colors bg-white/0 hover:bg-white/10 text-xs px-2 rounded-full"
                    style={{
                      color: disabled ? "red" : "rgba(255,255,255,.5)",
                    }}
                    onClick={() => {
                      let new_cells = cells.map((x, i) =>
                        i === cell_index ? { ...x, disabled: !x.disabled } : x
                      );
                      send_cells(new_cells);
                      set_currently_saved_cells(new_cells);
                      set_cells(new_cells);
                    }}
                  >
                    {disabled ? "disabled" : "active"}
                  </button>
                  <button
                    className="transition-colors bg-white/0 hover:bg-white/10 text-xs px-2 rounded-full"
                    style={{
                      color: collapsed
                        ? "rgba(255,255,255,1)"
                        : "rgba(255,255,255,.5)",
                    }}
                    onClick={() => {
                      let new_cells = cells.map((x, i) =>
                        i === cell_index ? { ...x, collapsed: !x.collapsed } : x
                      );
                      send_cells(new_cells);
                      set_currently_saved_cells(new_cells);
                      set_cells(new_cells);
                    }}
                  >
                    {collapsed ? "open" : "close"}
                  </button>
                </div>
              </div>

              <div style={{ display: collapsed ? "none" : "block" }}>
                <CellInput value={code}>
                  <Extension extension={placeholder("Style away!")} />
                  <Extension extension={cell_keymap} />
                  <Extension extension={CellIdFacet.of(id)} />
                  <Extension extension={dot_gutter} />
                  {/* <Extension extension={debug_syntax_plugin} /> */}
                  <Extension extension={pkgBubblePlugin()} />
                  <Extension
                    extension={EditorView.updateListener.of((update) => {
                      if (
                        update.state.field(ActiveSelector, false) !==
                        update.startState.field(ActiveSelector, false)
                      ) {
                        let cool = update.state.field(ActiveSelector, false);
                        window.parent.postMessage(
                          {
                            type: "highlight_selector",
                            selector: cool?.selector,
                          },
                          "*"
                        );
                      }
                    })}
                  />

                  <Extension
                    extension={EditorView.updateListener.of((update) => {
                      if (update.docChanged) {
                        let new_code = update.state.doc.toString();
                        let new_cells = immer(cells, (cells) => {
                          for (let cell of cells) {
                            if (cell.id === id) {
                              cell.code = new_code;
                            }
                          }
                        });
                        send_cells(new_cells);
                        set_cells(new_cells);
                      }
                    })}
                  />

                  <Extension
                    extension={EditorView.updateListener.of((update) => {
                      // Add react portals
                    })}
                  />
                </CellInput>
              </div>
            </Cell>
          </React.Fragment>
        );
      })}
      <AddCellButton
        onClick={() => {
          set_cells([...cells, empty_cell()]);
        }}
      />
    </div>
  );
}

let App = () => {
  // These two are just for tracking if the mouse is on the visible part of this iframe.
  // If it is, we are fine. If it isn't, we have to yield control back to the parent page.
  // The parent page will then set pointer-events: none on the iframe, and call `maybe enable again?` on mousemove
  // to give us a chance to take back control.
  React.useEffect(() => {
    let handler = (event) => {
      let element = document.elementFromPoint(event.clientX, event.clientY);
      if (element == null || element.tagName === "HTML") {
        window.parent.postMessage({ type: "disable me!" }, "*");
      }
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  });
  React.useEffect(() => {
    let handler = (message: MessageEvent) => {
      if (message.source !== window.parent) return;
      if (message.data?.type === "maybe enable again?") {
        let element = document.elementFromPoint(message.data.x, message.data.y);
        if (element != null && element.tagName !== "HTML") {
          window.parent.postMessage({ type: "enable me!" }, "*");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  return (
    <div>
      <AppContainer
        style={{
          right: 16,
          bottom: -16,
        }}
      >
        <Editor />
      </AppContainer>
    </div>
  );
};

let AppContainer = styled.div`
  position: fixed;
  height: max(60vh, min(500px, 100vh));
  width: max(20vw, 400px);
  overflow: auto;
  background-color: var(--main-bg-color);
  outline: rgba(255, 255, 255, 0.2) solid 1px;
  border-radius: 10px;
  padding-bottom: 16px;
  box-shadow: rgba(255, 255, 255, 0.04) 0px 0px 20px;
`;

export default App;
