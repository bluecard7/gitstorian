import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Router } from 'preact-router';

import Header from './header';
import Pane from './pane';

// Code-splitting is automated for `routes` directory
import Profile from '../routes/profile';

import style from './style.css';

// todo: verify connection to backend
// this is just a draft
function useCommit(cmd) {
	const { data } = fetch(':8081', {})
	return data
}

function Stack() {
	const [cmd, setCmd] = useState('view');
	const commit = useCommit(cmd);

	useEffect(() => {
		function handleKey({ code }) {
			code === 'KeyP' && setCmd('prev')
			code === 'KeyN' && setCmd('next')
			code === 'KeyV' && setCmd('view')
		}
		// add only to the stack? (w/ useRef)
		window?.addEventListener('keydown', handleKey);
		return () => window?.removeEventListener('keydown', handleKey);
	}, [])

	return (
		<div
			class={style.stack}>
			<Pane />
		</div>
	);
}

const App = () => (
	<div id="app">
		<Header />
		<Router>
			<Stack path="/" />
			<Profile path="/profile/" user="me" />
			<Profile path="/profile/:user" />
		</Router>
	</div>
)

export default App;
