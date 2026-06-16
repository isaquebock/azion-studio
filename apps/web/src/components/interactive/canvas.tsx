import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type Node,
  type NodeMouseHandler,
  type OnConnect,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ResourceNode } from "./nodes/resource-node";

const NODE_TYPES = {
  edge_app: ResourceNode,
  workload: ResourceNode,
  edge_function: ResourceNode,
  rule: ResourceNode,
};

type Props = {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: NodeMouseHandler;
  onNodesChange: OnNodesChange;
  onConnect: OnConnect;
  onEdgesChange: (changes: EdgeChange[]) => void;
  isValidConnection: IsValidConnection<Edge>;
};

export function Canvas({
  nodes,
  edges,
  onNodeClick,
  onNodesChange,
  onConnect,
  onEdgesChange,
  isValidConnection,
}: Props) {
  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
      style: { stroke: "hsl(0 0% 32%)", strokeWidth: 1.5 },
      deletable: true,
    }),
    [],
  );

  // Block self-loops outright; semantic rules (only app→workload/rule) come from
  // the parent via isValidConnection.
  const onBeforeConnect = (c: Connection) => c.source !== c.target;

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c) => {
          if (onBeforeConnect(c)) onConnect(c);
        }}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={{ stroke: "hsl(14 89% 56%)", strokeWidth: 1.5 }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        minZoom={0.3}
        maxZoom={1.6}
        deleteKeyCode={["Backspace", "Delete"]}
        connectionRadius={40}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="hsl(0 0% 18%)"
        />
        <Controls
          className="!bg-muted !border-border [&_button]:!bg-muted [&_button]:!border-border [&_button]:!text-foreground"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
