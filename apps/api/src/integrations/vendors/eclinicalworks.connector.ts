import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class EclinicalworksConnector extends VendorConnectorBase {
  public override readonly provider = 'eclinicalworks';
  protected override get displayName(){ return 'eClinicalWorks'; }
  protected override get mrnPrefix(){ return 'ECWRN'; }
  protected override get appointmentPrefix(){ return 'appt'; }
  protected override get patientPrefix(){ return 'Synthetic'; }
}
