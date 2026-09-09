import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from '../vendors/vendor-connector.base';
import { X12GeneratorService } from '../x12/x12-generator.service';
@Injectable()
export class AvailityConnector extends VendorConnectorBase {
 public override readonly provider='availity';
 protected override get displayName(){return 'Availity';}
 protected override get patientPrefix(){return 'Availity';}
 protected override get mrnPrefix(){return 'AVARN';}

}
