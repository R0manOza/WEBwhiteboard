import React from 'react';
import type { Container as ContainerType } from '../../../../shared/types';

interface ContainerProps {
  container: ContainerType;
  // Future props: onUpdatePosition, onUpdateSize, onDelete, etc.
}

const Container: React.FC<ContainerProps> = ({ container }) => {
  // Basic styling placeholder - actual positioning/sizing done by parent or drag library later
  const containerStyle: React.CSSProperties = {
    position: 'absolute', // Containers are positioned on the board
    left: `${container.position.x}px`, // Use position from data
    top: `${container.position.y}px`,
    width: `${container.size.width}px`, // Use size from data
    height: `${container.size.height}px`,
    border: '1px solid #000', // Basic visual border
    backgroundColor: container.style?.backgroundColor || '#fff', // Optional background
    padding: '10px',
    boxSizing: 'border-box', // Include padding in size
    cursor: 'grab', // Hint that it's draggable
     // Add more styles later
  };


  return (
    // Apply base class and potential type-specific class
    <div className={`container container-${container.purpose}`} style={containerStyle}>
      <h3>{container.title}</h3>
      {/* Placeholder for items list */}
      <div className="container-items-area" style={{ marginTop: '10px' }}>
        {/* Items will be rendered here in later phases */}
        <p style={{ fontSize: '0.8em', fontStyle: 'italic' }}>
             {container.purpose === 'notes' ? 'Notes' : 'Links'} go here (Phase 4/5)
         </p>
      </div>
    </div>
  );
};

export default Container;