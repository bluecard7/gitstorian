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
    map((e: unknown) => (e as React.KeyboardEvent).code),
    filter(Boolean),
  )


const fetchData = (pieces: string[], opts: object = {}): Promise<Response> => 
  fetch(urlify([baseURL, ...pieces]), opts)
    .then(data => data)

const loadPage = (
  dir: string = "", 
  hash: string = "", 
  path: string = "",
): Promise<string[]> => 
  fetchData(["commits", dir, hash, path])
    .then(res => res.ok ? res.json() : [])

const loadDiff = (
  hash: string = "", 
  path: string = "",
): Promise<{ 
  diff: string[], 
  pathMenu: string[], 
  order: { place: string, total: string }
}> => fetchData(["diffs", hash, path]).then(res => res.json())

const loadFileRaw = (
  hash: string = "", 
  path: string = "",
): Promise<string> => fetchData(["raw", hash, path]).then(res => res.text())

const pushBookmark = (hash: string): Promise<boolean> =>
  // will always return true for now, even if it failed
  fetchData(["bookmark", hash], { method: "POST" })
    .then(() => true)
    .catch(() => false)

interface State {
  hashes: string[];
  hashPos: number;
  menu: string[];
  diff: string[];
  readPath: string;
  bookmarkHash: string;
  order: { place?: string, total?: string };
}

interface Action {
  type: string;
  payload: 
    | string[] 
    | string
    | State["order"]
}

const initialState: State = {
  hashes: [],
  hashPos: -1,
  menu: [],
  diff: [], // todo: maybe this should just come as text
  readPath: "",
  bookmarkHash: "",
  order: {},
}

function reducer(state: State, action: Action): State {
  const { hashes, hashPos } = state
  const { payload } = action
  switch(action.type) {
    case "prev":
      const prevPage = payload as State["hashes"]
      return {
        ...state,
        hashes: prevPage.length
          ? prevPage.concat(hashes) 
          : hashes,
        hashPos: prevPage.length 
          ? prevPage.length - 1
          : hashPos - 1,
      }
    case "next":
      const nextPage = payload as State["hashes"]
      return {
        ...state,
        hashes: nextPage.length 
          ? hashes.concat(nextPage) 
          : hashes,
        hashPos: hashPos + 1,
      }
    case "menu":
      const menu = payload as State["menu"]
      return { ...state, menu }
    case "diff":
      const diff = payload as State["diff"]
      return { ...state, diff }
    case "read":
      const readPath = payload as State["readPath"]
      return { ...state, readPath }
    case "bookmark":
      const bookmarkHash = payload as State["bookmarkHash"]
      return { ...state, bookmarkHash }
    case "order":
      const order = payload as State["order"] 
      return { ...state, order }
  }
  return state
}

function useCommits() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { 
    hashes, 
    hashPos, 
    readPath, 
    menu, 
    diff, 
    order, 
    bookmarkHash,
  } = state;

  const hash = hashes[hashPos] 
  const hashMove = (dir: string) => {
    const bound = dir === "prev" ? 0 : hashes.length - 1;
    (hashPos === bound ? loadPage(dir, hash) : Promise.resolve([]))
      .then(page => dispatch({ type: dir, payload: page }))
    dispatch({ type: "read", payload: "" })
  }
  const bookmark = () => pushBookmark(hash).then(
    () => dispatch({ type: "bookmark", payload: hash })
  )

  useEffect(() => { 
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
    }
    loadPage().then(page => {
      dispatch({ type: "next", payload: page })
      dispatch({ type: "bookmark", payload: page[0] })
    })
  }, [])
 
  useEffect(() => {
      hash && loadDiff(hash, readPath).then(res => {
        dispatch({ type: "menu", payload: res.pathMenu })
        dispatch({ type: "diff", payload: res.diff })
        dispatch({ type: "order", payload: res.order })
      })
  }, [hash, readPath])

  return {
    hash,
    menu,
    diff,
    order,
    readPath,
    bookmarkHash,
    bookmark,
    setReadPath: (path: string) => dispatch({ type: "read", payload: path }),
    prevHash: () => hashMove("prev"),
    nextHash: () => hashMove("next"),
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
    hash,
    diff, 
    menu, 
    order,
    readPath, 
    bookmarkHash,
    bookmark,
    setReadPath,
    prevHash,
    nextHash,
  } = useCommits();

  useEffect(() => {
    if (!keydownObserver) return () => {};
    const subscription = keydownObserver.subscribe(code => {
      if (!["ArrowLeft", "ArrowRight"].includes(code)) { return }
      code === "ArrowLeft" && prevHash()
      code === "ArrowRight" && nextHash()
    });
    return () => subscription.unsubscribe()
  }, [prevHash, nextHash])
  
  const selectPath = (path: string) => setReadPath(path !== readPath ? path : "")
  const copyRaw = async () => 
    navigator.clipboard.writeText(await loadFileRaw(hash, readPath))
  const bookmarked = bookmarkHash === hash

  return (
    <div className={styles.container}>
      <Head>
        <title>ripthebuild</title>
      </Head>
      <div className={styles['nav-button-container']}>
        <button onClick={prevHash}> {"<"} </button>
        <p>{order.place || "???"} of {order.total || "???"}</p>
        <button onClick={nextHash}> {">"} </button>
      </div>
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
