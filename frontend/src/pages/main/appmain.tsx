import {Component, useState} from 'react';
import { useNavigate } from "react-router-dom";
import SideMenu from '../../components/menu';
import { Greet } from '../../../wailsjs/go/main/App';

function Appmain() {
    const [resultText, setResultText] = useState("Please enter your name below 👇");
    const [name, setName] = useState('');
    const updateName = (e: any) => setName(e.target.value);
    const updateResultText = (result: string) => setResultText(result);
    const navigate = useNavigate();
    const goInfo = () => {
        navigate("/info");
    };

    function greet() {
        Greet(name).then(updateResultText);
    }

    return (
        <div id="appmain">

        <div className="grid">
            <div className="col-3">
              <SideMenu></SideMenu>
            </div>
           
            <div className="col-9">
                <div className="text-center p-3 border-round-sm bg-primary font-bold">9asdasd</div>
            </div>

        </div>
        </div>
    )
}

export default Appmain
