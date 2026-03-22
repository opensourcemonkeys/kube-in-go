import {useState} from 'react';
import logo from './assets/images/logo-universal.png';
import './Info.css';
import {Greet} from "../../../wailsjs/go/main/App";

function App() {
    const [resultText, setResultText] = useState("Please enter your name below 👇");
    const [name, setName] = useState('');
    const updateName = (e: any) => setName(e.target.value);
    const updateResultText = (result: string) => setResultText(result);

    function greet() {
     
    }

    return (
        <div id="Info">
            Info page
        </div>
    )
}

export default App
