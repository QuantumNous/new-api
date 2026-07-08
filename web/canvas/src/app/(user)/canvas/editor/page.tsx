import { Suspense } from "react";
import CanvasClientPage from "./canvas-client-page";

export default function CanvasEditorPage() {
    return (
        <Suspense>
            <CanvasClientPage />
        </Suspense>
    );
}
