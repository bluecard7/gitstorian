import Head from "next/head"
import Image from "next/image"
import { Fragment, useEffect, useReducer } from "react"
import { fromEvent } from "rxjs"
import { filter, map, throttleTime } from "rxjs/operators"
import styles from "../styles/Frame.module.css"

const baseURL = "http://localhost:8081"
const urlify = (parts: string[]): string => parts.filter(Boolean).join("/")
const keydownObserver = typeof window !== "undefined" && fromEvent(document, "keydown")
  .pipe(
    throttleTime(200),
    map(e => e.code),
    filter(Boolean),
  )

if (
  typeof window !== "undefined" && 
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("registered"), () => console.log("fail"))
  });
}

const fetchData = (pieces: string[], opts: object = {}): Promise<Response> => 
  fetch(urlify([baseURL, ...pieces]), opts)
    .then(data => data)
    .catch(err => ({ text: () => err.message }))

async function loadPage(
  order: string = "", 
  hash: string = "", 
  path: string = "",
): Promise<string[]> {
  const res = await fetchData(["commits", order, hash, path])
  return res.ok ? res.json() : []
}

async function loadDiff(
  hash: string = "", 
  path: string = ""
): Promise<{ diff: string[], pathMenu: string[]}> {
  const res = await fetchData(["diffs", hash, path])
  return res.json()
}

async function loadFileRaw(
  hash: string = "", 
  path: string = ""
): Promise<string> {
  const res = await fetchData(["raw", hash, path])
  return res.text()
}

function pushBookmark(page: string[]): Promise<boolean> {
  // will always return true for now, even if it failed
  return fetchData(["bookmark"], {
    method: "POST",
    body: JSON.stringify(page),
  })
  .then(() => true)
  .catch(() => false)
}

const initialState = {
  hashes: [],
  hashPos: -1,
  menu: [],
  diff: [], // maybe this should just come as text
  readPath: "",
  bookmarkHash: "",
}

interface Message {
  type: string;
  payload: string[] | string
}

function reducer(state: typeof initialState, action: Message) {
  const { hashes, hashPos } = state
  const { payload } = action
  switch(action.type) {
    case "prev":
      return {
        ...state,
        hashes: payload?.length ? payload.concat(hashes) : hashes,
        hashPos: payload?.length ? payload.length - 1 : hashPos - 1,
      }
    case "next":
      return {
        ...state,
        hashes: payload?.length ? hashes.concat(payload) : hashes,
        hashPos: hashPos + 1,
      }
    case "menu":
      return { ...state, menu: payload || [] }
    case "diff":
      return { ...state, diff: payload || [] }
    case "read":
      return { ...state, readPath: payload || "" }
    case "bookmark":
      return { ...state, bookmarkHash: payload || "" }
  }
  return state
}

function useCommits() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { hashes, hashPos, readPath, menu, diff, bookmarkHash } = state;

  useEffect(() => { 
    loadPage().then(page => {
      dispatch({ type: "next", payload: page })
      dispatch({ type: "bookmark", payload: page[0] })
    })
  }, [])
 
  useEffect(() => {
    const subscription = keydownObserver.subscribe(code => {
      if (!["ArrowLeft", "ArrowRight"].includes(code)) return
      dispatch({ type: "read", payload: "" })
      if (code === "ArrowLeft") {
        (hashPos === 0 ? loadPage("prev", hashes[hashPos]) : Promise.resolve([]))
          .then(page => dispatch({ type: "prev", payload: page }))
      } else {
        (hashPos === hashes.length - 1 ? loadPage("next", hashes[hashPos]) : Promise.resolve([]))
          .then(page => dispatch({ type: "next", payload: page }))
      }
    });
    return () => subscription.unsubscribe()
  }, [hashes, hashPos])
  
  useEffect(() => {
      const hash = hashes[hashPos]
      hash && loadDiff(hash, readPath).then(res => {
        dispatch({ type: "menu", payload: res.pathMenu })
        dispatch({ type: "diff", payload: res.diff })
      })
  }, [hashes, hashPos, readPath])

  function bookmark() {
    const page = hashes.slice(hashPos)
    pushBookmark(page)
      .then(() => dispatch({ type: "bookmark", payload: page[0] }))
  }

  return {
    menu,
    diff,
    readPath,
    setReadPath: (path: string) => dispatch({ type: "read", payload: path }),
    bookmarked: bookmarkHash === hashes[hashPos],
    bookmark,
    getRaw: () => loadFileRaw(hashes.current[hashPos], readPath),
  }
}

function rowStyle (line: string): string {
  switch (line[0]) {
    case "+": return styles["row-add"]
    case "-": return styles["row-remove"]
  } 
  return ""
}

function buttonStyle (clicked: boolean): string {
  const clickedStyle = clicked ? styles["read-path"] : ""
  return `${styles["menu-button"]} ${clickedStyle}`
}

export default function Frame() {
  const { 
    diff, 
    menu, 
    readPath, 
    setReadPath,
    bookmarked,
    bookmark,
    getRaw,
  } = useCommits();
  
  const selectPath = (path: string) => {
    setReadPath(path !== readPath ? path : "")
  }
  const copyRaw = async () => {
    navigator.clipboard.writeText(await getRaw())
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>ripthebuild</title>
      </Head>
      <main className={styles.main}>
        <div className={styles.menu}>
          <button 
            className={styles["bookmark-button"]}
            onClick={bookmark}
            disabled={bookmarked}
          >
            {bookmarked ? "Bookmarked" : "Bookmark this commit" }
          </button>
          <button 
            className={styles["copy-button"]} 
            onClick={copyRaw}
            disabled={!readPath}
          >
            Copy content
          </button>
          {menu.map((path, pos) => (
            <button key={path}
              className={buttonStyle(path === readPath)}
              onClick={() => selectPath(path)} 
            >
              {path}
            </button>
          ))}
        </div>
        <table className={styles.diffview}>
          <tbody>
            {diff.map(line => {
              const statLine = line.split("|")
              return statLine.length === 2 ? (
                <tr>
                  <td>
                    <span className={styles.code}>
                      {statLine[0]}
                    </span>
                  </td> 
                  <td>
                    <span className={styles.code}>
                    | {statLine[1]}
                    </span>
                  </td>
                </tr>
              ) : (
                <tr className={rowStyle(line)}>
                  <td>
                    <span className={styles.code}>{line}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </main>
    </div>
  )
}
