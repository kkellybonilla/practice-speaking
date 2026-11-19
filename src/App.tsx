import { useRoute } from "./lib/route";
import { Coach } from "./screens/Coach";
import { Done } from "./screens/Done";
import { Home } from "./screens/Home";
import { Practice } from "./screens/Practice";
import { ScriptEdit } from "./screens/ScriptEdit";

export function App() {
  const route = useRoute();
  switch (route.name) {
    case "home":
      return <Home />;
    case "script":
      // No key here: when "#/script/new" becomes "#/script/<id>", the editor keeps its state.
      return <ScriptEdit id={route.id} />;
    case "practice":
      return <Practice key={route.id} id={route.id} />;
    case "done":
      return <Done key={route.takeId} takeId={route.takeId} />;
    case "coach":
      return <Coach />;
  }
}
