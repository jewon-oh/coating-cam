import React, { useRef, useEffect } from 'react';
import { Group, Transformer } from 'react-konva';
import { Shape } from 'konva/lib/Shape';

interface TransformableGroupProps {
  children: React.ReactNode;
  isSelected: boolean;
  onTransform: (node: Konva.Node, x: number, y: number) => void;
}

const TransformableGroup: React.FC<TransformableGroupProps> = ({
  children,
  isSelected,
  onTransform,
}) => {
  const groupRef = useRef<Group>(null);
  const transformerRef = useRef<Transformer>(null);

  useEffect(() => {
    if (isSelected && groupRef.current) {
      transformerRef.current?.nodes([groupRef.current as unknown as Shape]);
      transformerRef.current?.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Group
        ref={groupRef}
        draggable
        onTransform={(e) => {
          onTransform(e.target, groupRef.current.x(), groupRef.current.y());
          groupRef.current?.children.forEach(child => {
            console.log(`Shape ID: ${child.id()}, X: ${child.x()}, Y: ${child.y()}, Rotation: ${child.rotation()}`);
          });
        }}
      >
        {children}
      </Group>
      {isSelected && <Transformer ref={transformerRef} />}
    </>
  );
};

export default TransformableGroup;