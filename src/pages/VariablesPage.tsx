import React from "react";
import { useContainer } from "../context/ContainerContext";
import ItemList from "../components/ItemList";
import DetailsModal from "./DetailsModal";

export default function VariablesPage() {
  const { container } = useContainer();

  if (!container) {
    return (
      <p className="text-gray-500 text-sm">
        Carica prima un JSON nella sezione Dashboard.
      </p>
    );
  }

  return <ItemList items={container.variable ?? []} type="variable" />;
}