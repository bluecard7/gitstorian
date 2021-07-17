import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useRef, useCallback, useEffect, useState } from 'react'
import { fromEvent } from 'rxjs'
import { filter, map, throttleTime } from 'rxjs/operators'
import styles from '../styles/Frame.module.css'

const baseURL = 'http://localhost:8081'
const urlify = (parts: string[]): string => parts.filter(Boolean).join('/')
const keydownObserver = typeof window !== 'undefined' && fromEvent(document, 'keydown')
  .pipe(
    throttleTime(200),
    map(e => e.code),
    filter(Boolean),
  )

const fetchData = (pieces: string[]): Promise<Response> => {
  console.log(urlify(pieces))
  return fetch(urlify(pieces))
    .then(data => data)
    .catch(err => ({ text: () => err.message }))
}

async function loadPage(
  order: string = "", 
  hash: string = "", 
  path: string = "",
): Promise<string[]> {
  const res = await fetchData([baseURL, 'commits', order, hash, path])
  return res.ok ? (await res.json()) : []
}

async function loadDiff(
  hash: string = "", 
  path: string = ""
): Promise<{ diff: string[], pathMenu: string[]}> {
  const res = await fetchData([baseURL,'diffs', hash, path])
  return res.json()
}

function useCommits() {
  const hashes = useRef([])
  const [hashPos, setHashPos] = useState(-1)
  const [menu, setMenu] = useState([])
  const [diff, setDiff] = useState([])
  const [readPath, setReadPath] = useState("")
  const [bookmarkHash, setBookmarkHash] = useState("")
  
  const append = (page: string[]) => {
    hashes.current = hashes.current.concat(page)  
    setHashPos(hashPos + 1)
  }
  const prepend = (page: string[]) => {
    hashes.current = page.concat(hashes.current)
    setHashPos(page.length - 1)
  }
  const flip = (order: string): Promise<string[]> => {
    const hash = hashes.current[hashPos]
    const insert = order === "prev" ? prepend : append
    return loadPage(order, hash).then(insert)
  }
  const bookmark = () => {
    const page = hashes.current.slice(hashPos)
    // will always return true for now, even if it failed
    fetch(urlify([baseURL, 'bookmark']), {
      method: 'POST',
      body: JSON.stringify(page),
    })
    .then(() => setBookmarkHash(page[0]))
    .catch(() => {})
  }

  useEffect(() => { 
    loadPage().then(page => setBookmarkHash(page[0]))
  }, [])
 
  useEffect(() => {
    const subscription = keydownObserver.subscribe(code => {
      if (code === 'ArrowLeft') {
        if (hashPos === 0) {
          flip("prev")
        } else {
          setHashPos(hashPos - 1) 
        }
        setReadPath("")
      }
      if (code === 'ArrowRight') {
        if (hashPos === hashes.current.length - 1) {
          flip("next")
        } else {
          setHashPos(hashPos + 1) 
        }
        setReadPath("")
      }
    });
    return () => subscription.unsubscribe()
  }, [hashPos])

  useEffect(() => {
    const hash = hashes.current[hashPos]
    hash && loadDiff(hash, readPath).then(res => {
        setMenu(res.pathMenu || [])
        setDiff(res.diff || [])
    })
  }, [hashPos, readPath])

  return {
    menu,
    diff,
    readPath,
    setReadPath,
    bookmarked: bookmarkHash === hashes.current[hashPos],
    bookmark,
  }
}

// todo: resolve edited paths in the backend
//   - ex: perf/{ => map}/perf.js -> perf/map/perf.js in response
//   - resolve truncated paths
// todo: increase --stat=<width> to get longer paths
// todo: copy file contents at that version
function rowStyle (line: string): string {
  switch (line[0]) {
    case "+": return styles['row-add']
    case "-": return styles['row-remove']
  } 
  return ""
}

function buttonStyle (clicked: boolean): string {
  const clickedStyle = clicked ? styles['read-path'] : ''
  return `${styles['menu-button']} ${clickedStyle}`
}

export default function Frame() {
  const { 
    diff, 
    menu, 
    readPath, 
    setReadPath,
    bookmarked,
    bookmark,
  } = useCommits();
  
  const selectPath = (path: string) => {
    setReadPath(path !== readPath ? path : "")
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>ripthebuild</title>
      </Head>
      <main className={styles.main}>
        <div className={styles.menu}>
          <button 
            className={styles['bookmark-button']}
            onClick={bookmark}
            disabled={bookmarked}
          >
            {bookmarked ? 'Bookmarked' : 'Bookmark this commit' }
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
