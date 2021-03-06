/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package gov.usgs.cida.gdp.coreprocessing;

/**
 *
 * @author admin
 */
public class GroupBy {

        public enum StationOption {

            station("Station"),
            variable("Variable");

            public final String description;

            private StationOption(String description) {
                this.description = description;
            }

            @Override
            public String toString() {
                return description;
            }

            public static StationOption getDefault() {
                return station;
            }
        }

}
