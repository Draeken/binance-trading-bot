export type ratios = { [key: string]: { [key: string]: string } };

export interface ThresholdProps {
  ratios: ratios;
}

export class Threshold {
  private ratios: ratios;

  constructor(props: ThresholdProps) {
    this.ratios = props.ratios;
  }
}
