import style from './style.css';

function Pane({ pos }) {
	return (
		<div class={style.pane}>Hello World {pos}</div>
	);
}

export default Pane;
