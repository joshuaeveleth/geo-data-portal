package gov.usgs.gdp.analysis;

import com.vividsolutions.jts.geom.Coordinate;
import com.vividsolutions.jts.geom.Envelope;
import com.vividsolutions.jts.geom.Geometry;
import com.vividsolutions.jts.geom.GeometryFactory;
import org.geotools.geometry.jts.JTSFactoryFinder;
import ucar.nc2.dataset.CoordinateAxis1D;
import ucar.nc2.dt.GridCoordSystem;
import ucar.unidata.geoloc.LatLonPointImpl;
import ucar.unidata.geoloc.Projection;
import ucar.unidata.geoloc.ProjectionPointImpl;

/**
 *
 * @author tkunicki
 */
public class GridCellGeometry {

    private final GridCoordSystem gridCoordSystem;

    private final int xCellCount;
    private final int yCellCount;
    private final int cellCount;

    private Geometry[] cellGeometry;

    public GridCellGeometry(GridCoordSystem gridCoordSystem) {

        this.gridCoordSystem = gridCoordSystem;

        xCellCount = (int) gridCoordSystem.getXHorizAxis().getSize();
        yCellCount = (int) gridCoordSystem.getYHorizAxis().getSize();
        cellCount = xCellCount * yCellCount;

        generateCellGeometry();
    }

    public GridCoordSystem getGridCoordSystem() {
        return gridCoordSystem;
    }

    public int getCellCountX() {
        return xCellCount;
    }

    public int getCellCountY() {
        return yCellCount;
    }

    public int getCellCount() {
        return cellCount;
    }

    public Geometry getCellGeometry(int yxIndex) {
        return cellGeometry[yxIndex];
    }

    public Geometry getCellGeometry(int xIndex, int yIndex) {
        return cellGeometry[xIndex + yIndex * xCellCount];
    }

    private void generateCellGeometry() {

        GeometryFactory geometryFactory = JTSFactoryFinder.getGeometryFactory(null);

        CoordinateAxis1D xAxis = (CoordinateAxis1D) gridCoordSystem.getXHorizAxis();
        CoordinateAxis1D yAxis = (CoordinateAxis1D) gridCoordSystem.getYHorizAxis();

        double[] xCellEdges = xAxis.getCoordEdges();
        double[] yCellEdges = yAxis.getCoordEdges();

        int xCellEdgeCount = xCellEdges.length;

        cellGeometry = new Geometry[cellCount];

        final CoordinateBuilder coordinateBuilder = gridCoordSystem.isLatLon()
                ? new CoordinateBuilder()
                : new ProjectedCoordinateBuilder();

        Coordinate[] lowerCorner = null;
        Coordinate[] upperCorner = new Coordinate[xCellEdgeCount];

        // prime data storage for algorithm below...
        for (int xCellIndex = 1; xCellIndex < xCellEdgeCount; ++xCellIndex) {
            upperCorner[xCellIndex] = coordinateBuilder.getCoordinate(
                    xCellEdges[xCellIndex], yCellEdges[0]);
        }

        for (int yIndexLower = 0; yIndexLower < yCellCount; ++yIndexLower) {
            int yOffset = xCellCount * yIndexLower;
            int yIndexUpper = yIndexLower + 1;
            lowerCorner = upperCorner;
            upperCorner = new Coordinate[xCellEdgeCount];
            lowerCorner[0] = coordinateBuilder.getCoordinate(xCellEdges[0], yCellEdges[yIndexLower]);
            for (int xIndexLower = 0; xIndexLower < xCellCount; ++xIndexLower) {
                int xIndexUpper = xIndexLower + 1;
                upperCorner[xIndexUpper] = coordinateBuilder.getCoordinate(
                        xCellEdges[xIndexUpper],
                        yCellEdges[yIndexUpper]);
                Envelope cellEnvelope = new Envelope(
                        lowerCorner[xIndexLower],
                        upperCorner[xIndexUpper]);
                cellGeometry[yOffset + xIndexLower] = geometryFactory.toGeometry(cellEnvelope);
            }
        }
    }

    private class CoordinateBuilder {

        public Coordinate getCoordinate(double x, double y) {
            return new Coordinate(x, y);
        }
    }

    private class ProjectedCoordinateBuilder extends CoordinateBuilder {

        private Projection projection;
        private ProjectionPointImpl projectionPoint;
        private LatLonPointImpl latLonPoint;

        public ProjectedCoordinateBuilder() {
            projection = gridCoordSystem.getProjection();
            projectionPoint = new ProjectionPointImpl();
            latLonPoint = new LatLonPointImpl();
        }

        @Override
        public Coordinate getCoordinate(double x, double y) {
            projectionPoint.setLocation(x, y);
            projection.projToLatLon(projectionPoint, latLonPoint);
            return super.getCoordinate(latLonPoint.getLongitude(), latLonPoint.getLatitude());
        }
    }
}